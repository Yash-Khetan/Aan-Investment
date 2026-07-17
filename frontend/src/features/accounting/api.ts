import { apiRequest, downloadFile, toQueryString } from "../../lib/api";
import type { AccountingCategory, AccountingFilters, AccountingResponse } from "./types";

export function getAccountingEntries(
  category: AccountingCategory,
  filters: AccountingFilters,
): Promise<AccountingResponse> {
  const qs = toQueryString(filters as Record<string, string | undefined>);
  return apiRequest<AccountingResponse>(`/accounting/${category}${qs}`);
}

export function exportAccountingEntries(
  category: AccountingCategory,
  filters: AccountingFilters,
  format: "csv" | "xlsx",
): Promise<void> {
  const qs = toQueryString({ ...filters, format } as Record<string, string | undefined>);
  return downloadFile(`/accounting/export/${category}${qs}`, `${category}.${format}`);
}
