import { eq, and, asc, lte, gte, isNotNull } from "drizzle-orm";
import { db, ledgerEntries, loans } from "../../db";
import { NotFoundError } from "../../common/errors";

export type LedgerEntryRow = typeof ledgerEntries.$inferSelect;

/** Either the top-level `db` or a transaction handle from `db.transaction(...)` — both support the same query builder surface used here. */
type DbOrTx = typeof db | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/** All entries for a loan, oldest first — entryDate then sequenceNo as the stable same-day tiebreak. */
export async function getEntriesForLoan(loanId: string): Promise<LedgerEntryRow[]> {
  return db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.loanId, loanId))
    .orderBy(asc(ledgerEntries.entryDate), asc(ledgerEntries.sequenceNo));
}

/** Every entry dated on or before `monthEnd`, oldest first — the raw material for a month's balance walk. */
export async function getEntriesUpTo(loanId: string, monthEnd: string): Promise<LedgerEntryRow[]> {
  return db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.loanId, loanId), lte(ledgerEntries.entryDate, monthEnd)))
    .orderBy(asc(ledgerEntries.entryDate), asc(ledgerEntries.sequenceNo));
}

/** Distinct accrual months that already have a Journal pair, for gap detection. */
export async function getExistingAccrualMonths(loanId: string): Promise<string[]> {
  const rows = await db
    .select({ accrualMonth: ledgerEntries.accrualMonth })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.loanId, loanId),
        eq(ledgerEntries.vchType, "JOURNAL_INTEREST"),
        isNotNull(ledgerEntries.accrualMonth)
      )
    );

  return rows.map((r) => r.accrualMonth as string);
}

/**
 * Every already-posted Journal Interest entry whose accrual month is on or
 * after `fromMonth`, oldest first — used to cascade-recompute months whose
 * balance changed because a backdated Payment/Receipt landed before them.
 */
export async function getJournalInterestEntriesFromMonth(loanId: string, fromMonth: string): Promise<LedgerEntryRow[]> {
  return db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.loanId, loanId),
        eq(ledgerEntries.vchType, "JOURNAL_INTEREST"),
        isNotNull(ledgerEntries.accrualMonth),
        gte(ledgerEntries.accrualMonth, fromMonth)
      )
    )
    .orderBy(asc(ledgerEntries.accrualMonth));
}

export async function getEarliestEntryDate(loanId: string): Promise<string | null> {
  const rows = await db
    .select({ entryDate: ledgerEntries.entryDate })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.loanId, loanId))
    .orderBy(asc(ledgerEntries.entryDate))
    .limit(1);

  return rows[0]?.entryDate ?? null;
}

/**
 * Next Vch No. for a loan — one shared counter across all entry types, a plain
 * incrementing integer, restarting at 1 for every loan account. Runs inside the
 * caller's transaction so a concurrent insert can't race to the same number.
 */
async function getNextVchNo(loanId: string, tx: DbOrTx): Promise<string> {
  const rows = await tx
    .select({ vchNo: ledgerEntries.vchNo })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.loanId, loanId));

  const maxNo = rows.reduce((max, r) => Math.max(max, Number(r.vchNo) || 0), 0);
  return String(maxNo + 1);
}

export async function insertPaymentOrReceipt(input: {
  loanId: string;
  entryDate: string;
  vchType: "PAYMENT" | "RECEIPT";
  amount: number;
  narration?: string;
}): Promise<LedgerEntryRow> {
  return db.transaction(async (tx) => {
    const vchNo = await getNextVchNo(input.loanId, tx);

    const [created] = await tx
      .insert(ledgerEntries)
      .values({
        loanId: input.loanId,
        entryDate: input.entryDate,
        vchType: input.vchType,
        vchNo,
        debit: input.vchType === "PAYMENT" ? String(input.amount) : null,
        credit: input.vchType === "RECEIPT" ? String(input.amount) : null,
        narration: input.narration,
        isSystemGenerated: false,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create ledger entry.");
    }

    return created;
  });
}

/**
 * Inserts a month-end Journal Interest + TDS pair in one transaction, then
 * cross-links each row's pairedEntryId to the other (Postgres can't
 * self-reference a row not yet committed within a single INSERT).
 */
export async function insertJournalPair(input: {
  loanId: string;
  entryDate: string;
  accrualMonth: string;
  interestAmount: number;
  interestRatePercent: number;
  tdsAmount: number;
  tdsRatePercent: number;
}): Promise<{ interestEntry: LedgerEntryRow; tdsEntry: LedgerEntryRow }> {
  return db.transaction(async (tx) => {
    const interestVchNo = await getNextVchNo(input.loanId, tx);

    const [interestEntry] = await tx
      .insert(ledgerEntries)
      .values({
        loanId: input.loanId,
        entryDate: input.entryDate,
        vchType: "JOURNAL_INTEREST",
        vchNo: interestVchNo,
        debit: String(input.interestAmount),
        narration: `Being Interest @ ${input.interestRatePercent}%`,
        accrualMonth: input.accrualMonth,
        ratePercent: String(input.interestRatePercent),
        isSystemGenerated: true,
      })
      .returning();

    if (!interestEntry) {
      throw new Error("Failed to create Journal Interest entry.");
    }

    const tdsVchNo = await getNextVchNo(input.loanId, tx);

    const [tdsEntry] = await tx
      .insert(ledgerEntries)
      .values({
        loanId: input.loanId,
        entryDate: input.entryDate,
        vchType: "JOURNAL_TDS",
        vchNo: tdsVchNo,
        credit: String(input.tdsAmount),
        narration: `Being Tds @ ${input.tdsRatePercent}%`,
        accrualMonth: input.accrualMonth,
        ratePercent: String(input.tdsRatePercent),
        pairedEntryId: interestEntry.id,
        isSystemGenerated: true,
      })
      .returning();

    if (!tdsEntry) {
      throw new Error("Failed to create Journal TDS entry.");
    }

    await tx
      .update(ledgerEntries)
      .set({ pairedEntryId: tdsEntry.id })
      .where(eq(ledgerEntries.id, interestEntry.id));

    return { interestEntry: { ...interestEntry, pairedEntryId: tdsEntry.id }, tdsEntry };
  });
}

export async function getEntryById(entryId: string): Promise<LedgerEntryRow | null> {
  const rows = await db.select().from(ledgerEntries).where(eq(ledgerEntries.id, entryId)).limit(1);
  return rows[0] ?? null;
}

export async function updateEntryAmountAndRate(
  entryId: string,
  patch: { ratePercent: number; debit?: number | null; credit?: number | null },
  tx?: DbOrTx
): Promise<LedgerEntryRow> {
  const executor = tx ?? db;
  const [updated] = await executor
    .update(ledgerEntries)
    .set({
      ratePercent: String(patch.ratePercent),
      ...(patch.debit !== undefined ? { debit: patch.debit === null ? null : String(patch.debit) } : {}),
      ...(patch.credit !== undefined ? { credit: patch.credit === null ? null : String(patch.credit) } : {}),
      narration:
        patch.debit !== undefined
          ? `Being Interest @ ${patch.ratePercent}%`
          : `Being Tds @ ${patch.ratePercent}%`,
    })
    .where(eq(ledgerEntries.id, entryId))
    .returning();

  if (!updated) {
    throw new Error(`Failed to update ledger entry ${entryId}.`);
  }

  return updated;
}

/* ============================================================
   DEFAULT RATES — read from, and written to, the LOAN row

   There is no ledger settings table. The loan row is the single
   source of truth for both rates, so a rate edited on the Ledger
   page is immediately what the Loans module shows, and vice
   versa, with no sync step that could drift.
============================================================ */

export interface LoanLedgerRates {
  loanId: string;
  defaultInterestRatePercent: string;
  defaultTdsRatePercent: string;
}

export async function getLoanRates(loanId: string): Promise<LoanLedgerRates> {
  const rows = await db
    .select({
      id: loans.id,
      interestRate: loans.interestRate,
      tdsRatePercent: loans.tdsRatePercent,
    })
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new NotFoundError(`Loan ${loanId} not found.`);
  }

  return {
    loanId: row.id,
    defaultInterestRatePercent: row.interestRate,
    defaultTdsRatePercent: row.tdsRatePercent,
  };
}

export async function updateLoanRates(
  loanId: string,
  input: { defaultInterestRatePercent: number; defaultTdsRatePercent: number }
): Promise<LoanLedgerRates> {
  const [updated] = await db
    .update(loans)
    .set({
      interestRate: String(input.defaultInterestRatePercent),
      tdsRatePercent: String(input.defaultTdsRatePercent),
    })
    .where(eq(loans.id, loanId))
    .returning({
      id: loans.id,
      interestRate: loans.interestRate,
      tdsRatePercent: loans.tdsRatePercent,
    });

  if (!updated) {
    throw new NotFoundError(`Loan ${loanId} not found.`);
  }

  return {
    loanId: updated.id,
    defaultInterestRatePercent: updated.interestRate,
    defaultTdsRatePercent: updated.tdsRatePercent,
  };
}
