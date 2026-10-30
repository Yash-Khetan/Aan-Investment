import { eq, and, asc, isNull, lte, gte, inArray, isNotNull, max, sql } from "drizzle-orm";
import { db, ledgerEntries, ledgerImports, loans } from "../../db";
import { NotFoundError } from "../../common/errors";
import { EDITABLE_VCH_TYPES, type EditableVchType } from "./entryRules";

/**
 * `created_at` and `locked_at` default to the database's own `now()`, so
 * stamping an update with the Node process's `new Date()` would mix two
 * clocks — see modules/borrower/promoter.repository.ts for the same note.
 * Everything written here is stamped by the one clock.
 */
const dbNow = sql`now()`;

export type LedgerEntryRow = typeof ledgerEntries.$inferSelect;

/** Either the top-level `db` or a transaction handle — for callers outside this module. */
export type LedgerDbOrTx = typeof db | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/** Either the top-level `db` or a transaction handle from `db.transaction(...)` — both support the same query builder surface used here. */
type DbOrTx = typeof db | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/**
 * Runs `work` inside one transaction. This is how a service makes a ledger
 * write and its audit-trail entry commit or roll back together, without
 * reaching for `db` itself — `db` stays inside the repositories.
 */
export async function inLedgerTransaction<T>(work: (tx: LedgerDbOrTx) => Promise<T>): Promise<T> {
  return db.transaction(work);
}

/** All entries for a loan, oldest first — entryDate then sequenceNo as the stable same-day tiebreak. */
export async function getEntriesForLoan(loanId: string): Promise<LedgerEntryRow[]> {
  return db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.loanId, loanId))
    .orderBy(asc(ledgerEntries.entryDate), asc(ledgerEntries.sequenceNo));
}

/** All entries for several loans in one read, each loan's oldest first — for list views. */
export async function getEntriesForLoans(loanIds: string[]): Promise<LedgerEntryRow[]> {
  if (loanIds.length === 0) return [];
  return db
    .select()
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.loanId, loanIds))
    .orderBy(asc(ledgerEntries.loanId), asc(ledgerEntries.entryDate), asc(ledgerEntries.sequenceNo));
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
 * Every Journal Interest entry the ledger posted itself (source SYSTEM) whose
 * accrual month is on or after `fromMonth`, oldest first — the months to
 * cascade-recompute when a backdated entry or an import changes the balance
 * before them. Imported journals are the sheet's own figures and are never
 * returned here, so they are never recalculated.
 */
export async function getJournalInterestEntriesFromMonth(loanId: string, fromMonth: string): Promise<LedgerEntryRow[]> {
  return db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.loanId, loanId),
        eq(ledgerEntries.vchType, "JOURNAL_INTEREST"),
        eq(ledgerEntries.source, "SYSTEM"),
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
export async function getNextVchNo(loanId: string, tx: DbOrTx): Promise<string> {
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
        source: "MANUAL",
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
  /** Snapshotted with the rates, so a later configuration change can't move this month. */
  interestBasis: string;
  includeOpeningClosingDays: boolean;
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
        interestBasis: input.interestBasis as any,
        includeOpeningClosingDays: input.includeOpeningClosingDays,
        isSystemGenerated: true,
        source: "SYSTEM",
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
        interestBasis: input.interestBasis as any,
        includeOpeningClosingDays: input.includeOpeningClosingDays,
        pairedEntryId: interestEntry.id,
        isSystemGenerated: true,
        source: "SYSTEM",
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

/** One entry, only if it belongs to that loan — so an id from another loan reads as missing rather than as somebody else's row. */
export async function getLoanEntryById(loanId: string, entryId: string): Promise<LedgerEntryRow | null> {
  const rows = await db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.id, entryId), eq(ledgerEntries.loanId, loanId)))
    .limit(1);
  return rows[0] ?? null;
}

/* ============================================================
   EDITING A HAND-RECORDED ENTRY

   Both writes below carry the editability rules in their own
   WHERE clause: locked rows, the ledger's own month-end journals
   and anything that is not a hand-recorded Payment/Receipt match
   nothing and so change nothing. The service checks the same
   rules first, to answer with a reason rather than a silent
   no-op — these clauses are the floor under that check, not a
   substitute for it, so no future caller can reach past it.
============================================================ */

/** Matches only a row that may be edited: unlocked, hand-recorded, a Payment or Receipt. */
const editableEntry = (entryId: string) =>
  and(
    eq(ledgerEntries.id, entryId),
    isNull(ledgerEntries.lockedAt),
    eq(ledgerEntries.source, "MANUAL"),
    inArray(ledgerEntries.vchType, [...EDITABLE_VCH_TYPES]),
  );

/**
 * Applies an edit to one hand-recorded Payment/Receipt. Returns null when the
 * row is locked (or was never editable), having changed nothing.
 *
 * Only the four editable columns are set. `vchNo`, `source`, `sequenceNo` and
 * every snapshot column are left exactly as they were, so an edited row keeps
 * its place in the loan's voucher sequence and its same-day order.
 */
export async function updateManualEntry(
  entryId: string,
  values: { entryDate: string; vchType: EditableVchType; debit: string | null; credit: string | null; narration: string | null },
  tx?: DbOrTx,
): Promise<LedgerEntryRow | null> {
  const executor = tx ?? db;
  const [updated] = await executor
    .update(ledgerEntries)
    .set({ ...values, updatedAt: dbNow })
    .where(editableEntry(entryId))
    .returning();

  return updated ?? null;
}

/**
 * Removes one hand-recorded Payment/Receipt. Returns null when the row is
 * locked (or was never editable), having removed nothing.
 *
 * Deliberately a hard delete. Every ledger read is the full set of rows for a
 * loan — none of them filters `deleted_at` — so a soft-deleted entry would go
 * on counting in every balance, which is the one thing a removal must not do.
 */
export async function deleteManualEntry(entryId: string, tx?: DbOrTx): Promise<LedgerEntryRow | null> {
  const executor = tx ?? db;
  const [deleted] = await executor.delete(ledgerEntries).where(editableEntry(entryId)).returning();

  return deleted ?? null;
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
   LOAN READS

   There is no ledger settings table, and no write path from here
   back onto the loan. The rates a month accrues at come from the
   loan's effective-dated interest configuration — see
   ledger.service.ts's resolveAccrualConfig.
============================================================ */

/** The loan's maturity date — the far edge of its DPD grid. Null when the loan has none recorded. */
export async function getLoanMaturityDate(loanId: string): Promise<string | null> {
  const rows = await db
    .select({ maturityDate: loans.maturityDate })
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new NotFoundError(`Loan ${loanId} not found.`);
  }

  return row.maturityDate ?? null;
}

/**
 * Where a loan's imported history ends, across every import posted to it:
 * the last imported row's date (manual entries must be dated after it) and
 * the month of the last imported Interest journal (the ledger posts its own
 * month-end interest only after it). Both null when nothing was imported.
 */
export async function getHistoryCutoff(
  loanId: string
): Promise<{ lastEntryDate: string | null; lastInterestMonth: string | null }> {
  const [row] = await db
    .select({
      lastEntryDate: max(ledgerImports.lastEntryDate),
      lastInterestMonth: max(ledgerImports.lastInterestMonth),
    })
    .from(ledgerImports)
    .where(eq(ledgerImports.loanId, loanId));

  return { lastEntryDate: row?.lastEntryDate ?? null, lastInterestMonth: row?.lastInterestMonth ?? null };
}

/**
 * Several loans' lifecycle statuses in one read, keyed by loan id — for list
 * views that must not fire one query per loan. A loan id that does not exist
 * is simply absent, rather than throwing as the single-loan read does.
 */
export async function getLoanStatuses(loanIds: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (loanIds.length === 0) return result;

  const rows = await db
    .select({ id: loans.id, status: loans.status })
    .from(loans)
    .where(inArray(loans.id, loanIds));

  for (const row of rows) result.set(row.id, row.status);
  return result;
}

/** The loan's lifecycle status. Throws when the loan does not exist. */
export async function getLoanStatus(loanId: string): Promise<string | null> {
  const [row] = await db.select({ status: loans.status }).from(loans).where(eq(loans.id, loanId)).limit(1);
  if (!row) throw new NotFoundError(`Loan ${loanId} not found.`);
  return row.status;
}

export async function setLoanStatus(loanId: string, status: "ACTIVE" | "CLOSED"): Promise<void> {
  await db.update(loans).set({ status, updatedAt: new Date() }).where(eq(loans.id, loanId));
}
