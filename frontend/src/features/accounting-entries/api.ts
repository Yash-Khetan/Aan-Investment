import { apiRequest } from "../../lib/api";
import type { JournalEntry, RecordDisbursementInput, RecordWriteOffInput } from "./types";

interface Envelope<T> {
  success: true;
  data: T;
}

export async function recordDisbursement(input: RecordDisbursementInput): Promise<JournalEntry> {
  const res = await apiRequest<Envelope<JournalEntry>>("/accounting-entries/disbursement", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function recordWriteOff(input: RecordWriteOffInput): Promise<JournalEntry> {
  const res = await apiRequest<Envelope<JournalEntry>>("/accounting-entries/write-off", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function getLedger(loanId: string): Promise<JournalEntry[]> {
  const res = await apiRequest<Envelope<JournalEntry[]>>(`/accounting-entries/${loanId}`);
  return res.data;
}
