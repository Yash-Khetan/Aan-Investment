import { apiRequest } from "../../lib/api";
import type { CreateEntryInput, DpdGrid, LedgerEntry, LoanLedger } from "./types";

interface Envelope<T> {
  success: true;
  data: T;
}

export async function getLedger(loanId: string): Promise<LoanLedger> {
  const res = await apiRequest<Envelope<LoanLedger>>(`/ledger/${loanId}`);
  return res.data;
}

export async function createEntry(loanId: string, input: CreateEntryInput): Promise<LedgerEntry> {
  const res = await apiRequest<Envelope<LedgerEntry>>(`/ledger/${loanId}/entries`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function getDpdHistory(loanId: string): Promise<DpdGrid> {
  const res = await apiRequest<Envelope<DpdGrid>>(`/ledger/${loanId}/dpd`);
  return res.data;
}
