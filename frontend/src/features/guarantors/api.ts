import { apiRequest } from "../../lib/api";
import type { CreateGuarantorInput, Guarantor, UpdateGuarantorInput } from "./types";

interface Envelope<T> {
  success: true;
  data: T;
}

export async function listGuarantors(loanId: string): Promise<Guarantor[]> {
  const res = await apiRequest<Envelope<Guarantor[]>>(`/api/v1/loans/${loanId}/guarantors`);
  return res.data;
}

export async function createGuarantor(loanId: string, input: CreateGuarantorInput): Promise<Guarantor> {
  const res = await apiRequest<Envelope<Guarantor>>(`/api/v1/loans/${loanId}/guarantors`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateGuarantor(loanId: string, id: string, input: UpdateGuarantorInput): Promise<Guarantor> {
  const res = await apiRequest<Envelope<Guarantor>>(`/api/v1/loans/${loanId}/guarantors/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function deleteGuarantor(loanId: string, id: string): Promise<void> {
  await apiRequest<Envelope<{ id: string; deleted: true }>>(`/api/v1/loans/${loanId}/guarantors/${id}`, {
    method: "DELETE",
  });
}
