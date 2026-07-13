import { apiRequest } from "../../lib/api";
import type { Payment, RecordPaymentInput, RecordPaymentResult } from "./types";

interface Envelope<T> {
  success: true;
  data: T;
}

export async function recordPayment(input: RecordPaymentInput): Promise<RecordPaymentResult> {
  const res = await apiRequest<Envelope<RecordPaymentResult>>("/payments", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function getPaymentHistory(loanId: string): Promise<Payment[]> {
  const res = await apiRequest<Envelope<Payment[]>>(`/payments/${loanId}`);
  return res.data;
}
