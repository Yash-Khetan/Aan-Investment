import { eq, and, asc, lte, gte, isNotNull } from "drizzle-orm";
import { db, borrowerLedgerEntries, borrowerLedgerSettings } from "../../db";

export type LedgerEntryRow = typeof borrowerLedgerEntries.$inferSelect;

/** Either the top-level `db` or a transaction handle from `db.transaction(...)` — both support the same query builder surface used here. */
type DbOrTx = typeof db | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/** All entries for a borrower, oldest first — entryDate then sequenceNo as the stable same-day tiebreak. */
export async function getEntriesForBorrower(borrowerId: string): Promise<LedgerEntryRow[]> {
  return db
    .select()
    .from(borrowerLedgerEntries)
    .where(eq(borrowerLedgerEntries.borrowerId, borrowerId))
    .orderBy(asc(borrowerLedgerEntries.entryDate), asc(borrowerLedgerEntries.sequenceNo));
}

/** Every entry dated on or before `monthEnd`, oldest first — the raw material for a month's balance walk. */
export async function getEntriesUpTo(borrowerId: string, monthEnd: string): Promise<LedgerEntryRow[]> {
  return db
    .select()
    .from(borrowerLedgerEntries)
    .where(and(eq(borrowerLedgerEntries.borrowerId, borrowerId), lte(borrowerLedgerEntries.entryDate, monthEnd)))
    .orderBy(asc(borrowerLedgerEntries.entryDate), asc(borrowerLedgerEntries.sequenceNo));
}

/** Distinct accrual months that already have a Journal pair, for gap detection. */
export async function getExistingAccrualMonths(borrowerId: string): Promise<string[]> {
  const rows = await db
    .select({ accrualMonth: borrowerLedgerEntries.accrualMonth })
    .from(borrowerLedgerEntries)
    .where(
      and(
        eq(borrowerLedgerEntries.borrowerId, borrowerId),
        eq(borrowerLedgerEntries.vchType, "JOURNAL_INTEREST"),
        isNotNull(borrowerLedgerEntries.accrualMonth)
      )
    );

  return rows.map((r) => r.accrualMonth as string);
}

/**
 * Every already-posted Journal Interest entry whose accrual month is on or
 * after `fromMonth`, oldest first — used to cascade-recompute months whose
 * balance changed because a backdated Payment/Receipt landed before them.
 */
export async function getJournalInterestEntriesFromMonth(borrowerId: string, fromMonth: string): Promise<LedgerEntryRow[]> {
  return db
    .select()
    .from(borrowerLedgerEntries)
    .where(
      and(
        eq(borrowerLedgerEntries.borrowerId, borrowerId),
        eq(borrowerLedgerEntries.vchType, "JOURNAL_INTEREST"),
        isNotNull(borrowerLedgerEntries.accrualMonth),
        gte(borrowerLedgerEntries.accrualMonth, fromMonth)
      )
    )
    .orderBy(asc(borrowerLedgerEntries.accrualMonth));
}

export async function getEarliestEntryDate(borrowerId: string): Promise<string | null> {
  const rows = await db
    .select({ entryDate: borrowerLedgerEntries.entryDate })
    .from(borrowerLedgerEntries)
    .where(eq(borrowerLedgerEntries.borrowerId, borrowerId))
    .orderBy(asc(borrowerLedgerEntries.entryDate))
    .limit(1);

  return rows[0]?.entryDate ?? null;
}

/**
 * Next Vch No. for a borrower — one shared counter across all entry types,
 * a plain incrementing integer. Runs inside the caller's transaction so a
 * concurrent insert can't race to the same number.
 */
async function getNextVchNo(borrowerId: string, tx: DbOrTx): Promise<string> {
  const rows = await tx
    .select({ vchNo: borrowerLedgerEntries.vchNo })
    .from(borrowerLedgerEntries)
    .where(eq(borrowerLedgerEntries.borrowerId, borrowerId));

  const maxNo = rows.reduce((max, r) => Math.max(max, Number(r.vchNo) || 0), 0);
  return String(maxNo + 1);
}

export async function insertPaymentOrReceipt(input: {
  borrowerId: string;
  entryDate: string;
  vchType: "PAYMENT" | "RECEIPT";
  amount: number;
  narration?: string;
}): Promise<LedgerEntryRow> {
  return db.transaction(async (tx) => {
    const vchNo = await getNextVchNo(input.borrowerId, tx);

    const [created] = await tx
      .insert(borrowerLedgerEntries)
      .values({
        borrowerId: input.borrowerId,
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
  borrowerId: string;
  entryDate: string;
  accrualMonth: string;
  interestAmount: number;
  interestRatePercent: number;
  tdsAmount: number;
  tdsRatePercent: number;
}): Promise<{ interestEntry: LedgerEntryRow; tdsEntry: LedgerEntryRow }> {
  return db.transaction(async (tx) => {
    const interestVchNo = await getNextVchNo(input.borrowerId, tx);

    const [interestEntry] = await tx
      .insert(borrowerLedgerEntries)
      .values({
        borrowerId: input.borrowerId,
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

    const tdsVchNo = await getNextVchNo(input.borrowerId, tx);

    const [tdsEntry] = await tx
      .insert(borrowerLedgerEntries)
      .values({
        borrowerId: input.borrowerId,
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
      .update(borrowerLedgerEntries)
      .set({ pairedEntryId: tdsEntry.id })
      .where(eq(borrowerLedgerEntries.id, interestEntry.id));

    return { interestEntry: { ...interestEntry, pairedEntryId: tdsEntry.id }, tdsEntry };
  });
}

export async function getEntryById(entryId: string): Promise<LedgerEntryRow | null> {
  const rows = await db.select().from(borrowerLedgerEntries).where(eq(borrowerLedgerEntries.id, entryId)).limit(1);
  return rows[0] ?? null;
}

export async function updateEntryAmountAndRate(
  entryId: string,
  patch: { ratePercent: number; debit?: number | null; credit?: number | null },
  tx?: DbOrTx
): Promise<LedgerEntryRow> {
  const executor = tx ?? db;
  const [updated] = await executor
    .update(borrowerLedgerEntries)
    .set({
      ratePercent: String(patch.ratePercent),
      ...(patch.debit !== undefined ? { debit: patch.debit === null ? null : String(patch.debit) } : {}),
      ...(patch.credit !== undefined ? { credit: patch.credit === null ? null : String(patch.credit) } : {}),
      narration:
        patch.debit !== undefined
          ? `Being Interest @ ${patch.ratePercent}%`
          : `Being Tds @ ${patch.ratePercent}%`,
    })
    .where(eq(borrowerLedgerEntries.id, entryId))
    .returning();

  if (!updated) {
    throw new Error(`Failed to update ledger entry ${entryId}.`);
  }

  return updated;
}

export async function getOrCreateSettings(borrowerId: string) {
  const rows = await db
    .select()
    .from(borrowerLedgerSettings)
    .where(eq(borrowerLedgerSettings.borrowerId, borrowerId))
    .limit(1);

  if (rows[0]) return rows[0];

  const [created] = await db
    .insert(borrowerLedgerSettings)
    .values({ borrowerId })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  // Lost the race to a concurrent insert — read back what's there now.
  const retry = await db
    .select()
    .from(borrowerLedgerSettings)
    .where(eq(borrowerLedgerSettings.borrowerId, borrowerId))
    .limit(1);

  if (!retry[0]) {
    throw new Error(`Failed to create ledger settings for borrower ${borrowerId}.`);
  }

  return retry[0];
}

export async function updateSettings(
  borrowerId: string,
  input: { defaultInterestRatePercent: number; defaultTdsRatePercent: number }
) {
  await getOrCreateSettings(borrowerId);

  const [updated] = await db
    .update(borrowerLedgerSettings)
    .set({
      defaultInterestRatePercent: String(input.defaultInterestRatePercent),
      defaultTdsRatePercent: String(input.defaultTdsRatePercent),
    })
    .where(eq(borrowerLedgerSettings.borrowerId, borrowerId))
    .returning();

  if (!updated) {
    throw new Error(`Failed to update ledger settings for borrower ${borrowerId}.`);
  }

  return updated;
}
