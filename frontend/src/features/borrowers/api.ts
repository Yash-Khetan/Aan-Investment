import { apiRequest, toQueryString } from "../../lib/api";
import type {
  Borrower,
  BorrowerDetail,
  CreateBorrowerInput,
  ListBorrowersResult,
  PaginationMeta,
  UpdateBorrowerInput,
} from "./types";

interface Envelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export async function listBorrowers(params: { search?: string; page?: number } = {}): Promise<ListBorrowersResult> {
  const qs = toQueryString({
    search: params.search,
    page: params.page ? String(params.page) : undefined,
  });
  const res = await apiRequest<Envelope<Borrower[]>>(`/api/v1/borrowers${qs}`);
  return { data: res.data, meta: res.meta! };
}

export async function getBorrower(id: string): Promise<BorrowerDetail> {
  const res = await apiRequest<Envelope<BorrowerDetail>>(`/api/v1/borrowers/${id}`);
  return res.data;
}

export async function createBorrower(input: CreateBorrowerInput): Promise<BorrowerDetail> {
  const res = await apiRequest<Envelope<BorrowerDetail>>("/api/v1/borrowers", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateBorrower(id: string, input: UpdateBorrowerInput): Promise<BorrowerDetail> {
  const res = await apiRequest<Envelope<BorrowerDetail>>(`/api/v1/borrowers/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function deleteBorrower(id: string): Promise<void> {
  await apiRequest<Envelope<{ id: string; deleted: true }>>(`/api/v1/borrowers/${id}`, {
    method: "DELETE",
  });
}
