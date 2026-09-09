import { apiRequest } from "../../lib/api";
import type { AttachRowsResult, KpiLedgerRow, KpiLedgerRowInput, PaginatedKpiLedger } from "./types";

interface Envelope<T> {
  success: true;
  data: T;
}

/** Append browser-parsed rows (or a single manual entry) to a loan's KPI history. */
export async function attachKpiRows(
  loanId: string,
  rows: KpiLedgerRowInput[],
  sourceFileName?: string,
  sourceMeta?: string | null,
): Promise<AttachRowsResult> {
  const res = await apiRequest<Envelope<AttachRowsResult>>(`/kpi-ledger/${loanId}/rows`, {
    method: "POST",
    body: JSON.stringify({ rows, sourceFileName, sourceMeta: sourceMeta ?? undefined }),
  });
  return res.data;
}

/** Paginated read of a loan's KPI history (30 rows/page by default). */
export async function getKpiLedger(loanId: string, page = 1, limit = 30): Promise<PaginatedKpiLedger> {
  const res = await apiRequest<Envelope<PaginatedKpiLedger>>(
    `/kpi-ledger/${loanId}?page=${page}&limit=${limit}`,
  );
  return res.data;
}

export async function updateKpiRow(
  loanId: string,
  rowId: string,
  patch: Partial<KpiLedgerRowInput>,
): Promise<KpiLedgerRow> {
  const res = await apiRequest<Envelope<KpiLedgerRow>>(`/kpi-ledger/${loanId}/rows/${rowId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return res.data;
}

export async function deleteKpiRow(loanId: string, rowId: string): Promise<void> {
  await apiRequest<Envelope<{ id: string; deleted: true }>>(`/kpi-ledger/${loanId}/rows/${rowId}`, {
    method: "DELETE",
  });
}
