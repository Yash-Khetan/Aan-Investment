import { apiRequest, toQueryString } from "../../lib/api";
import type {
  Borrower,
  BorrowerDetail,
  BorrowerType,
  CreateBorrowerInput,
  ListBorrowersResult,
  PaginationMeta,
  Promoter,
  UpdateBorrowerInput,
} from "./types";

interface Envelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export async function listBorrowers(
  params: { search?: string; page?: number; borrowerType?: BorrowerType | "" } = {},
): Promise<ListBorrowersResult> {
  const qs = toQueryString({
    search: params.search,
    page: params.page ? String(params.page) : undefined,
    borrowerType: params.borrowerType || undefined,
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

/* ------------------------------------------------------------------ */
/* Related persons ("promoters") — nested under their borrower         */
/* ------------------------------------------------------------------ */

const promotersUrl = (borrowerId: string) => `/api/v1/borrowers/${borrowerId}/promoters`;

export async function listPromoters(borrowerId: string): Promise<Promoter[]> {
  const res = await apiRequest<Envelope<Promoter[]>>(promotersUrl(borrowerId));
  return res.data;
}

export async function createPromoter(borrowerId: string, input: Promoter): Promise<Promoter> {
  const res = await apiRequest<Envelope<Promoter>>(promotersUrl(borrowerId), {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updatePromoter(borrowerId: string, id: string, input: Partial<Promoter>): Promise<Promoter> {
  const res = await apiRequest<Envelope<Promoter>>(`${promotersUrl(borrowerId)}/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function deletePromoter(borrowerId: string, id: string): Promise<void> {
  await apiRequest<Envelope<{ id: string; deleted: true }>>(`${promotersUrl(borrowerId)}/${id}`, {
    method: "DELETE",
  });
}
