import { apiRequest, toQueryString } from "../../lib/api";
import type { ChangeRequest, ChangeRequestEntityType, ListChangeRequestsFilters } from "./types";

interface Envelope<T> {
  success: boolean;
  data: T;
}

function filtersToQueryString(filters: ListChangeRequestsFilters): string {
  return toQueryString({
    status: filters.status,
    entityType: filters.entityType,
    loanId: filters.loanId,
    page: filters.page?.toString(),
    limit: filters.limit?.toString(),
  });
}

/** GET /change-requests — admin: pending change requests (or whatever status is filtered in). */
export async function listPendingChangeRequests(filters: ListChangeRequestsFilters): Promise<ChangeRequest[]> {
  const res = await apiRequest<Envelope<ChangeRequest[]>>(`/change-requests${filtersToQueryString(filters)}`);
  return res.data;
}

/** GET /change-requests/mine — the signed-in user's own change requests. */
export async function listMyChangeRequests(filters: ListChangeRequestsFilters): Promise<ChangeRequest[]> {
  const res = await apiRequest<Envelope<ChangeRequest[]>>(`/change-requests/mine${filtersToQueryString(filters)}`);
  return res.data;
}

export async function approveChangeRequest(id: string, notes?: string): Promise<ChangeRequest> {
  const res = await apiRequest<Envelope<ChangeRequest>>(`/change-requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
  return res.data;
}

export async function rejectChangeRequest(id: string, notes?: string): Promise<ChangeRequest> {
  const res = await apiRequest<Envelope<ChangeRequest>>(`/change-requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
  return res.data;
}

export async function bulkApproveChangeRequests(ids: string[], notes?: string): Promise<ChangeRequest[]> {
  const res = await apiRequest<Envelope<ChangeRequest[]>>("/change-requests/bulk-approve", {
    method: "POST",
    body: JSON.stringify({ ids, notes }),
  });
  return res.data;
}

export async function bulkRejectChangeRequests(ids: string[], notes?: string): Promise<ChangeRequest[]> {
  const res = await apiRequest<Envelope<ChangeRequest[]>>("/change-requests/bulk-reject", {
    method: "POST",
    body: JSON.stringify({ ids, notes }),
  });
  return res.data;
}

export async function approveAllChangeRequests(
  filters: { entityType?: ChangeRequestEntityType; loanId?: string },
  notes?: string,
): Promise<ChangeRequest[]> {
  const res = await apiRequest<Envelope<ChangeRequest[]>>("/change-requests/approve-all", {
    method: "POST",
    body: JSON.stringify({ ...filters, notes }),
  });
  return res.data;
}

export async function rejectAllChangeRequests(
  filters: { entityType?: ChangeRequestEntityType; loanId?: string },
  notes?: string,
): Promise<ChangeRequest[]> {
  const res = await apiRequest<Envelope<ChangeRequest[]>>("/change-requests/reject-all", {
    method: "POST",
    body: JSON.stringify({ ...filters, notes }),
  });
  return res.data;
}

/** GET /change-requests/pending-loan-ids — loan ids with something pending (for a list-page badge). */
export async function listPendingLoanIds(): Promise<string[]> {
  const res = await apiRequest<Envelope<string[]>>("/change-requests/pending-loan-ids");
  return res.data;
}
