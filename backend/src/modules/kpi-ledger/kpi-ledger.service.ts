import {
  assertLoanExists,
  appendRowsForLoan,
  listPaginated,
  updateRow,
  softDeleteRow,
} from "./kpi-ledger.repository";
import type {
  AttachRowsInput,
  AttachRowsResult,
  KpiLedgerRow,
  KpiLedgerRowInput,
  PaginatedKpiLedgerRows,
} from "./kpi-ledger.types";

/**
 * Appends browser-parsed (or manually entered) rows to a loan's KPI history.
 * Also used for the single-row "add entry" form — that just sends `rows` of
 * length 1.
 */
export async function attachRowsToLoan(input: AttachRowsInput): Promise<AttachRowsResult> {
  await assertLoanExists(input.loanId);

  const { appended, totalRows } = await appendRowsForLoan({
    loanId: input.loanId,
    rows: input.rows,
    sourceFileName: input.sourceFileName ?? null,
    sourceMeta: input.sourceMeta ?? null,
    importedBy: input.importedBy,
  });

  return { loanId: input.loanId, appended, totalRows };
}

export async function getLedgerPage(
  loanId: string,
  page: number,
  limit: number
): Promise<PaginatedKpiLedgerRows> {
  await assertLoanExists(loanId);
  const { rows, total } = await listPaginated(loanId, page, limit);
  return {
    rows,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function editRow(
  loanId: string,
  rowId: string,
  patch: KpiLedgerRowInput
): Promise<KpiLedgerRow> {
  await assertLoanExists(loanId);
  return updateRow(loanId, rowId, patch);
}

export async function removeRow(loanId: string, rowId: string): Promise<void> {
  await assertLoanExists(loanId);
  await softDeleteRow(loanId, rowId);
}
