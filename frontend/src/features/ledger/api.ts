import { apiRequest } from "../../lib/api";
import type { CreateEntryInput, DpdGrid, LedgerEntry, LoanLedger, UpdateEntryInput } from "./types";

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

/**
 * Edit a hand-recorded Payment or Receipt. The server refuses a locked
 * (imported) or system-posted entry with 403 and the reason, whatever the UI
 * offered.
 */
export async function updateEntry(loanId: string, entryId: string, input: UpdateEntryInput): Promise<LedgerEntry> {
  const res = await apiRequest<Envelope<LedgerEntry>>(`/ledger/${loanId}/entries/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return res.data;
}

/** Remove a hand-recorded Payment or Receipt. Locked entries go only with their whole import. */
export async function deleteEntry(loanId: string, entryId: string): Promise<LedgerEntry> {
  const res = await apiRequest<Envelope<LedgerEntry>>(`/ledger/${loanId}/entries/${entryId}`, {
    method: "DELETE",
  });
  return res.data;
}

export async function getDpdHistory(loanId: string): Promise<DpdGrid> {
  const res = await apiRequest<Envelope<DpdGrid>>(`/ledger/${loanId}/dpd`);
  return res.data;
}
