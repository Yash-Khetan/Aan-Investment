import { apiRequest, downloadFile, toQueryString } from "../../lib/api";
import type { ReportFilters, ReportName, ReportResponse, ReportRow } from "./types";

export function getReport(report: ReportName, filters: ReportFilters): Promise<ReportResponse<ReportRow>> {
  const qs = toQueryString(filters as Record<string, string | undefined>);
  return apiRequest<ReportResponse<ReportRow>>(`/reports/${report}${qs}`);
}

export function exportReport(report: ReportName, filters: ReportFilters, format: "csv" | "xlsx"): Promise<void> {
  const qs = toQueryString({ ...filters, format } as Record<string, string | undefined>);
  return downloadFile(`/reports/export/${report}${qs}`, `${report}.${format}`);
}
