import type { LedgerEntryRow } from "./ledger.repository";
import type { BalanceBifurcation, ReceiptAllocation } from "./ledger.types";

/**
 * Receipt appropriation for one loan's ledger: which month's interest, and
 * how much principal, each Receipt settled — and so what every running
 * balance is made of.
 *
 * The ledger is walked in its own posted order (entryDate, then sequenceNo),
 * and the balance is kept as principal plus one bucket per accrual month:
 *
 *   Payment           adds to principal.
 *   Journal Interest  opens (or adds to) its accrual month's bucket.
 *   Journal TDS       comes off that same month's bucket — the TDS is
 *                     deducted at source, so only the net is owed to us.
 *   Receipt           clears the buckets oldest-first, and whatever is left
 *                     over reduces principal for good.
 *
 * Surplus never waits as an advance against interest not yet posted: once a
 * receipt reaches principal it stays there, and next month's interest is a
 * fresh obligation. The buckets plus principal always add up to the running
 * balance, so the bifurcation shown beside a row ties to that row's balance.
 *
 * Pure, with no database access — the DPD grid and the Loans list both
 * appropriate receipts through this one walk, so they can never disagree
 * with the Ledger about what has been paid.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** One accrual month's interest obligation, as the walk leaves it. */
export interface InterestObligation {
  /** First of the accrual month, YYYY-MM-DD. */
  month: string;
  /** The day the month's Interest journal was posted — when it fell due. */
  dueDate: string;
  /** Interest net of its TDS: what the borrower has to remit for the month. */
  netAmount: number;
  /** Still unpaid on it. */
  remaining: number;
}

export interface LedgerAllocation {
  /** What the running balance is made of immediately after each entry, by entry id. */
  bifurcationAfter: Map<string, BalanceBifurcation>;
  /** How each Receipt was appropriated, by entry id. */
  receipts: Map<string, ReceiptAllocation>;
  /** Every month's obligation after the last entry walked, oldest first. */
  obligations: InterestObligation[];
  /** What the closing balance is made of. */
  closing: BalanceBifurcation;
}

interface Bucket {
  month: string;
  dueDate: string;
  gross: number;
  tds: number;
  paid: number;
}

const remainingOf = (b: Bucket): number => round2(b.gross - b.tds - b.paid);

/** The month a journal row accrues for — its accrualMonth, or its own date's month for a row without one. */
function monthOf(entry: LedgerEntryRow): string {
  return entry.accrualMonth ?? `${entry.entryDate.slice(0, 7)}-01`;
}

/**
 * Appropriates every Receipt in `entries`, which must already be in posted
 * order (as every ledger repository read returns them).
 */
export function allocateLedger(entries: LedgerEntryRow[]): LedgerAllocation {
  let principal = 0;
  const buckets = new Map<string, Bucket>();
  const bifurcationAfter = new Map<string, BalanceBifurcation>();
  const receipts = new Map<string, ReceiptAllocation>();

  const sortedBuckets = (): Bucket[] => [...buckets.values()].sort((a, b) => (a.month < b.month ? -1 : 1));

  const snapshot = (): BalanceBifurcation => ({
    principal: round2(principal),
    interest: sortedBuckets()
      .map((b) => ({ month: b.month, amount: remainingOf(b) }))
      .filter((b) => b.amount !== 0),
  });

  for (const entry of entries) {
    const debit = Number(entry.debit ?? 0);
    const credit = Number(entry.credit ?? 0);

    switch (entry.vchType) {
      case "PAYMENT":
        principal = round2(principal + debit);
        break;

      case "JOURNAL_INTEREST": {
        const month = monthOf(entry);
        const bucket = buckets.get(month);
        if (bucket) bucket.gross = round2(bucket.gross + debit);
        else buckets.set(month, { month, dueDate: entry.entryDate, gross: debit, tds: 0, paid: 0 });
        break;
      }

      case "JOURNAL_TDS": {
        const bucket = buckets.get(monthOf(entry));
        // TDS beyond what the month still owes (it was already paid off)
        // has nothing left to reduce there, so it comes off principal.
        const applied = bucket ? Math.max(Math.min(credit, remainingOf(bucket)), 0) : 0;
        if (bucket) bucket.tds = round2(bucket.tds + applied);
        principal = round2(principal - (credit - applied));
        break;
      }

      case "RECEIPT": {
        let left = credit;
        const allocation: ReceiptAllocation = { interest: [], principal: 0 };

        for (const bucket of sortedBuckets()) {
          if (left <= 0) break;
          const owed = remainingOf(bucket);
          if (owed <= 0) continue;

          const applied = round2(Math.min(left, owed));
          bucket.paid = round2(bucket.paid + applied);
          left = round2(left - applied);
          allocation.interest.push({ month: bucket.month, amount: applied, cleared: remainingOf(bucket) <= 0 });
        }

        if (left > 0) {
          principal = round2(principal - left);
          allocation.principal = left;
        }
        receipts.set(entry.id, allocation);
        break;
      }
    }

    bifurcationAfter.set(entry.id, snapshot());
  }

  const obligations = sortedBuckets().map((b) => ({
    month: b.month,
    dueDate: b.dueDate,
    netAmount: round2(b.gross - b.tds),
    remaining: remainingOf(b),
  }));

  return { bifurcationAfter, receipts, obligations, closing: snapshot() };
}
