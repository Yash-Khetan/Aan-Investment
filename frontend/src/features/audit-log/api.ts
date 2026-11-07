import { apiRequest, toQueryString } from "../../lib/api";
import type { AuditLog, ListAuditLogsFilters } from "./types";

interface Envelope<T> {
  success: boolean;
  data: T;
}

/** GET /audit-logs — admin only. Every change any employee has made. */
export async function listAuditLogs(filters: ListAuditLogsFilters): Promise<AuditLog[]> {
  const qs = toQueryString({
    entityType: filters.entityType,
    userId: filters.userId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    page: filters.page?.toString(),
    limit: filters.limit?.toString(),
  });
  const res = await apiRequest<Envelope<AuditLog[]>>(`/audit-logs${qs}`);
  return res.data;
}
