import { apiRequest } from "../../lib/api";
import type { Disbursement, RecordDisbursementInput } from "./types";

interface Envelope<T> {
  success: true;
  data: T;
}

export async function listDisbursements(loanId: string): Promise<Disbursement[]> {
  const res = await apiRequest<Envelope<Disbursement[]>>(`/api/v1/loans/${loanId}/disbursements`);
  return res.data;
}

export async function recordDisbursement(
  loanId: string,
  input: RecordDisbursementInput,
): Promise<Disbursement> {
  const res = await apiRequest<Envelope<Disbursement>>(`/api/v1/loans/${loanId}/disbursements`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}
