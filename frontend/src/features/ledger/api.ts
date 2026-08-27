import { apiRequest } from "../../lib/api";
import type { CreateEntryInput, LedgerEntry, LedgerSettings, LoanLedger, UpdateSettingsInput } from "./types";

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

export async function editJournalRate(loanId: string, entryId: string, ratePercent: number): Promise<LoanLedger> {
  const res = await apiRequest<Envelope<LoanLedger>>(`/ledger/${loanId}/entries/${entryId}/rate`, {
    method: "PATCH",
    body: JSON.stringify({ ratePercent }),
  });
  return res.data;
}

export async function getSettings(loanId: string): Promise<LedgerSettings> {
  const res = await apiRequest<Envelope<LedgerSettings>>(`/ledger/${loanId}/settings`);
  return res.data;
}

export async function updateSettings(loanId: string, input: UpdateSettingsInput): Promise<LedgerSettings> {
  const res = await apiRequest<Envelope<LedgerSettings>>(`/ledger/${loanId}/settings`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return res.data;
}
