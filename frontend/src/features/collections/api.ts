import { apiRequest } from "../../lib/api";
import type { CollectionActivityRecord, CreateActivityInput } from "./types";

export function getLoanActivities(loanId: string): Promise<CollectionActivityRecord[]> {
  return apiRequest<CollectionActivityRecord[]>(`/collections/loan/${loanId}`);
}

export function createActivity(input: CreateActivityInput): Promise<CollectionActivityRecord> {
  return apiRequest<CollectionActivityRecord>("/collections", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateStatus(id: string, status: string): Promise<CollectionActivityRecord> {
  return apiRequest<CollectionActivityRecord>(`/collections/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function createPromiseToPay(id: string, promiseDate: string, promiseAmount: number) {
  return apiRequest(`/collections/${id}/promise-to-pay`, {
    method: "POST",
    body: JSON.stringify({ promiseDate, promiseAmount }),
  });
}

export function closePromiseToPay(id: string, kept: boolean, remarks?: string) {
  return apiRequest(`/collections/${id}/promise-to-pay/close`, {
    method: "PATCH",
    body: JSON.stringify({ kept, remarks }),
  });
}
