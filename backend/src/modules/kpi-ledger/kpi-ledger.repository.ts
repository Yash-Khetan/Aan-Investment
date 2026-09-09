import { and, eq, asc, isNull, sql } from "drizzle-orm";
import { db, kpiLedgerRows, loans } from "../../db";
import { NotFoundError } from "../../common/errors";
import type { KpiLedgerRow, KpiLedgerRowInput } from "./kpi-ledger.types";

/** Every value column is stored verbatim, so this is a straight pass-through. */
function toApiRow(row: typeof kpiLedgerRows.$inferSelect): KpiLedgerRow {
  return {
    id: row.id,
    rowIndex: row.rowIndex,
    date: row.entryDate,
    particulars: row.particulars,
    vchType: row.vchType,
    vchNo: row.vchNo,
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
  };
}

/** Maps an input row's fields onto insertable/updatable columns, keeping text as-is. */
function toColumns(row: KpiLedgerRowInput) {
  return {
    entryDate: row.date ?? null,
    particulars: row.particulars ?? "",
    vchType: row.vchType ?? null,
    vchNo: row.vchNo ?? null,
    debit: row.debit ?? null,
    credit: row.credit ?? null,
    balance: row.balance ?? null,
  };
}

const notDeleted = (loanId: string) =>
  and(eq(kpiLedgerRows.loanId, loanId), isNull(kpiLedgerRows.deletedAt));

export async function assertLoanExists(loanId: string): Promise<void> {
  const [row] = await db.select({ id: loans.id }).from(loans).where(eq(loans.id, loanId)).limit(1);
  if (!row) throw new NotFoundError(`Loan ${loanId} not found.`);
}

/**
 * Appends rows to this loan's KPI history in one transaction. row_index continues
 * from the current maximum for the loan, so attaching another file never
 * disturbs — or replaces — what is already there.
 */
export async function appendRowsForLoan(input: {
  loanId: string;
  rows: KpiLedgerRowInput[];
  sourceFileName: string | null;
  sourceMeta: string | null;
  importedBy: string;
}): Promise<{ appended: number; totalRows: number }> {
  return db.transaction(async (tx) => {
    const [maxRow] = await tx
      .select({ maxIndex: sql<number | null>`max(${kpiLedgerRows.rowIndex})` })
      .from(kpiLedgerRows)
      .where(eq(kpiLedgerRows.loanId, input.loanId));

    let nextIndex = (maxRow?.maxIndex ?? -1) + 1;

    const values = input.rows.map((row) => ({
      loanId: input.loanId,
      rowIndex: nextIndex++,
      ...toColumns(row),
      sourceFileName: input.sourceFileName,
      sourceMeta: input.sourceMeta,
      importedBy: input.importedBy,
    }));

    if (values.length > 0) {
      await tx.insert(kpiLedgerRows).values(values);
    }

    const [countRow] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(kpiLedgerRows)
      .where(notDeleted(input.loanId));

    return { appended: values.length, totalRows: countRow?.total ?? 0 };
  });
}

/** Page through one loan's KPI history in row order. */
export async function listPaginated(
  loanId: string,
  page: number,
  limit: number
): Promise<{ rows: KpiLedgerRow[]; total: number }> {
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(kpiLedgerRows)
    .where(notDeleted(loanId))
    .orderBy(asc(kpiLedgerRows.rowIndex))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(kpiLedgerRows)
    .where(notDeleted(loanId));

  return { rows: rows.map(toApiRow), total: countRow?.total ?? 0 };
}

/** Edits the value fields of one row. Throws NotFoundError if it isn't a live row of this loan. */
export async function updateRow(
  loanId: string,
  rowId: string,
  patch: KpiLedgerRowInput
): Promise<KpiLedgerRow> {
  const columns = toColumns(patch);
  // Only overwrite fields the caller actually sent.
  const set: Partial<typeof kpiLedgerRows.$inferInsert> = { updatedAt: new Date() };
  if ("date" in patch) set.entryDate = columns.entryDate;
  if ("particulars" in patch) set.particulars = columns.particulars;
  if ("vchType" in patch) set.vchType = columns.vchType;
  if ("vchNo" in patch) set.vchNo = columns.vchNo;
  if ("debit" in patch) set.debit = columns.debit;
  if ("credit" in patch) set.credit = columns.credit;
  if ("balance" in patch) set.balance = columns.balance;

  const [row] = await db
    .update(kpiLedgerRows)
    .set(set)
    .where(and(eq(kpiLedgerRows.id, rowId), notDeleted(loanId)))
    .returning();

  if (!row) throw new NotFoundError(`KPI ledger row ${rowId} not found for loan ${loanId}.`);
  return toApiRow(row);
}

/** Soft-deletes one row. KPI history rows are never hard-deleted. */
export async function softDeleteRow(loanId: string, rowId: string): Promise<void> {
  const [row] = await db
    .update(kpiLedgerRows)
    .set({ deletedAt: new Date() })
    .where(and(eq(kpiLedgerRows.id, rowId), notDeleted(loanId)))
    .returning({ id: kpiLedgerRows.id });

  if (!row) throw new NotFoundError(`KPI ledger row ${rowId} not found for loan ${loanId}.`);
}
