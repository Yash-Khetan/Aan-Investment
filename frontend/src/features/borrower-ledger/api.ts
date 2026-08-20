import { apiRequest } from "../../lib/api";
import type { BorrowerLedger, CreateEntryInput, LedgerEntry, LedgerSettings, UpdateSettingsInput } from "./types";

interface Envelope<T> {
  success: true;
  data: T;
}

export async function getLedger(borrowerId: string): Promise<BorrowerLedger> {
  const res = await apiRequest<Envelope<BorrowerLedger>>(`/borrower-ledger/${borrowerId}`);
  return res.data;
}

export async function createEntry(borrowerId: string, input: CreateEntryInput): Promise<LedgerEntry> {
  const res = await apiRequest<Envelope<LedgerEntry>>(`/borrower-ledger/${borrowerId}/entries`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function editJournalRate(borrowerId: string, entryId: string, ratePercent: number): Promise<BorrowerLedger> {
  const res = await apiRequest<Envelope<BorrowerLedger>>(`/borrower-ledger/${borrowerId}/entries/${entryId}/rate`, {
    method: "PATCH",
    body: JSON.stringify({ ratePercent }),
  });
  return res.data;
}

export async function getSettings(borrowerId: string): Promise<LedgerSettings> {
  const res = await apiRequest<Envelope<LedgerSettings>>(`/borrower-ledger/${borrowerId}/settings`);
  return res.data;
}

export async function updateSettings(borrowerId: string, input: UpdateSettingsInput): Promise<LedgerSettings> {
  const res = await apiRequest<Envelope<LedgerSettings>>(`/borrower-ledger/${borrowerId}/settings`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return res.data;
}
