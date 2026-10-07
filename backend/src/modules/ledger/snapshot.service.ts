import { getEntriesForLoans, type LedgerEntryRow } from "./ledger.repository";
import { syncMissingMonthEndJournals } from "./ledger.service";
import { computeLoanSnapshot, type LoanSnapshot } from "./snapshot";

/** Today as YYYY-MM-DD in this process's own calendar — the same day the ledger's month-end walk uses. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Several loans' ledgers in one read, keyed by loan id, each in posted order.
 * Every requested loan is present, with an empty list when it has no entries.
 *
 * Posts any missing month-end journals first, so a ledger nobody has opened
 * lately still shows last month's interest.
 */
export async function getSyncedLedgers(loanIds: string[]): Promise<Map<string, LedgerEntryRow[]>> {
  const byLoan = new Map<string, LedgerEntryRow[]>(loanIds.map((id) => [id, []]));
  if (loanIds.length === 0) return byLoan;

  await Promise.all(loanIds.map((id) => syncMissingMonthEndJournals(id)));

  for (const row of await getEntriesForLoans(loanIds)) byLoan.get(row.loanId)?.push(row);
  return byLoan;
}

/**
 * Snapshots for several loans, keyed by loan id. Every requested loan is
 * present — one with no ledger entries yet gets an all-zero snapshot rather
 * than being left out, so callers never have to invent a fallback of their own.
 */
export async function getLoanSnapshots(
  loanIds: string[],
  asOf: string = todayIso()
): Promise<Map<string, LoanSnapshot>> {
  const result = new Map<string, LoanSnapshot>();
  for (const [id, rows] of await getSyncedLedgers(loanIds)) result.set(id, computeLoanSnapshot(rows, asOf));
  return result;
}

export async function getLoanSnapshot(loanId: string, asOf?: string): Promise<LoanSnapshot> {
  const snapshots = await getLoanSnapshots([loanId], asOf);
  return snapshots.get(loanId)!;
}
