import { apiRequest, toQueryString } from "../../lib/api";
import type { CreateLoanInput, Loan, ListLoansResult, PaginationMeta, UpdateLoanInput } from "./types";

interface Envelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export async function listLoans(params: { search?: string; page?: number } = {}): Promise<ListLoansResult> {
  const qs = toQueryString({
    search: params.search,
    page: params.page ? String(params.page) : undefined,
  });
  const res = await apiRequest<Envelope<Loan[]>>(`/api/v1/loans${qs}`);
  return { data: res.data, meta: res.meta! };
}

export async function getLoan(id: string): Promise<Loan> {
  const res = await apiRequest<Envelope<Loan>>(`/api/v1/loans/${id}`);
  return res.data;
}

export async function createLoan(input: CreateLoanInput): Promise<Loan> {
  const res = await apiRequest<Envelope<Loan>>("/api/v1/loans", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateLoan(id: string, input: UpdateLoanInput): Promise<Loan> {
  const res = await apiRequest<Envelope<Loan>>(`/api/v1/loans/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function deleteLoan(id: string): Promise<void> {
  await apiRequest<Envelope<{ id: string; deleted: true }>>(`/api/v1/loans/${id}`, {
    method: "DELETE",
  });
}
