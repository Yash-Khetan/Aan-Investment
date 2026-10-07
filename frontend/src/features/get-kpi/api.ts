import { apiRequest } from "../../lib/api";
import type { ImportPreview, ImportSheetPayload, LedgerImportSummary, PaginatedKpiLedger } from "./types";

interface Envelope<T> {
  success: true;
  data: T;
}

/** What posting this sheet into the loan's ledger would do. Writes nothing. */
export async function previewImport(loanId: string, sheet: ImportSheetPayload): Promise<ImportPreview> {
  const res = await apiRequest<Envelope<ImportPreview>>(`/kpi-ledger/${loanId}/imports/preview`, {
    method: "POST",
    body: JSON.stringify(sheet),
  });
  return res.data;
}

/** Post the sheet into the loan's ledger. Refused unless its preview is clean. */
export async function postImport(
  loanId: string,
  sheet: ImportSheetPayload,
): Promise<{ importId: string; loanStatus: string | null }> {
  const res = await apiRequest<Envelope<{ importId: string; loanStatus: string | null }>>(`/kpi-ledger/${loanId}/imports`, {
    method: "POST",
    body: JSON.stringify(sheet),
  });
  return res.data;
}

export async function listImports(loanId: string): Promise<LedgerImportSummary[]> {
  const res = await apiRequest<Envelope<LedgerImportSummary[]>>(`/kpi-ledger/${loanId}/imports`);
  return res.data;
}

/** Remove an import and every ledger entry it posted. */
export async function removeImport(loanId: string, importId: string): Promise<{ loanStatus: string | null }> {
  const res = await apiRequest<Envelope<{ loanStatus: string | null }>>(`/kpi-ledger/${loanId}/imports/${importId}`, {
    method: "DELETE",
  });
  return res.data;
}

/** The imported rows exactly as the sheets showed them, 30 at a time. */
export async function getKpiLedger(loanId: string, page = 1, limit = 30): Promise<PaginatedKpiLedger> {
  const res = await apiRequest<Envelope<PaginatedKpiLedger>>(`/kpi-ledger/${loanId}?page=${page}&limit=${limit}`);
  return res.data;
}
