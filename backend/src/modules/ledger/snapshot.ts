import type { LedgerEntryRow } from "./ledger.repository";
import type { BalanceBifurcation } from "./ledger.types";
import { allocateLedger } from "./allocation";
import { computeDpdAsOf, type LoanClassification } from "./dpd";

/**
 * LOAN SNAPSHOT — every figure about a loan's money, as at one date, read
 * off its ledger and nothing else.
 *
 * This is the one place a loan's outstanding, dues, overdue, DPD and
 * classification are worked out. The Loans list, the Ledger page, the
 * Dashboard, Reports, Collateral LTV and IRR all read these figures, so no
 * two screens can show different numbers for the same loan.
 *
 * Pure — no database access. It adds no arithmetic of its own: the split of
 * the balance comes from the receipt appropriation (allocation.ts) and the
 * DPD from dpd.ts, exactly as the Ledger page shows them.
 */

export interface LoanSnapshot {
  /** The date the figures are as at, YYYY-MM-DD. */
  asOf: string;
  /** False while the ledger has no entries on or before `asOf` — every figure is then zero. */
  hasEntries: boolean;

  /** Principal plus each month's unpaid net interest — the parts of the closing balance. */
  bifurcation: BalanceBifurcation;
  /** Principal still to be repaid. Negative only when more has been received than lent. */
  principalOutstanding: number;
  /** Interest posted (net of TDS) and not yet received, all months together. */
  interestOutstanding: number;
  /** Everything the borrower owes: principal plus unpaid interest. Always equals `closingBalance`. */
  totalPayable: number;
  /** The ledger's running balance after its last entry on or before `asOf`. */
  closingBalance: number;

  /** Unpaid interest that has already fallen due before `asOf`. */
  amountOverdue: number;
  dpd: number;
  classification: LoanClassification;
  oldestOverdueDueDate: string | null;
  /**
   * When money next falls due: the oldest month's interest still unpaid,
   * or — when nothing is unpaid and principal is still out — the coming
   * month-end, when the next Interest journal posts. Null once the loan
   * owes nothing.
   */
  nextDueDate: string | null;

  /** Sum of Payment (disbursement) entries. */
  totalDisbursed: number;
  /** Sum of Receipt entries. */
  totalReceived: number;
  /** Sum of gross Interest journals. */
  totalInterest: number;
  /** Sum of TDS journals. */
  totalTds: number;
  firstDisbursementDate: string | null;
  lastReceiptDate: string | null;
}

/**
 * Raised when the parts of the balance do not add up to the balance. The
 * appropriation guarantees they do, so this only fires on a real defect —
 * and a defect in a money figure must stop the read, not be shown.
 */
export class SnapshotIntegrityError extends Error {
  constructor(loanId: string | undefined, asOf: string, closingBalance: number, partsTotal: number) {
    super(
      `Ledger for loan ${loanId ?? "(unknown)"} does not tie out as at ${asOf}: ` +
        `balance ${closingBalance.toFixed(2)} but principal + unpaid interest = ${partsTotal.toFixed(2)}.`
    );
    this.name = "SnapshotIntegrityError";
  }
}

/** A tie-out difference at or below this is rounding, not a defect. */
const TIE_OUT_TOLERANCE = 0.01;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Last day of the month containing a YYYY-MM-DD date, as YYYY-MM-DD. */
function monthEndOf(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0));
  return last.toISOString().slice(0, 10);
}

/** Last day of the month after the one containing a YYYY-MM-DD date. */
function nextMonthEndOf(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m! + 1, 0));
  return last.toISOString().slice(0, 10);
}

/**
 * The snapshot of one loan's ledger as at `asOf`. `entries` must be that
 * loan's entries in posted order (entryDate, then sequenceNo), as every
 * ledger repository read returns them; entries dated after `asOf` are
 * ignored.
 */
export function computeLoanSnapshot(entries: LedgerEntryRow[], asOf: string): LoanSnapshot {
  const upTo = entries.filter((e) => e.entryDate <= asOf);
  const allocation = allocateLedger(upTo);
  const dpd = computeDpdAsOf(upTo, asOf);

  let closingBalance = 0;
  let totalDisbursed = 0;
  let totalReceived = 0;
  let totalInterest = 0;
  let totalTds = 0;
  let firstDisbursementDate: string | null = null;
  let lastReceiptDate: string | null = null;

  for (const e of upTo) {
    const debit = Number(e.debit ?? 0);
    const credit = Number(e.credit ?? 0);
    closingBalance += debit - credit;

    switch (e.vchType) {
      case "PAYMENT":
        totalDisbursed += debit;
        if (firstDisbursementDate === null) firstDisbursementDate = e.entryDate;
        break;
      case "RECEIPT":
        totalReceived += credit;
        lastReceiptDate = e.entryDate;
        break;
      case "JOURNAL_INTEREST":
        totalInterest += debit;
        break;
      case "JOURNAL_TDS":
        totalTds += credit;
        break;
    }
  }

  closingBalance = round2(closingBalance);
  const { principal, interest } = allocation.closing;
  const interestOutstanding = round2(interest.reduce((sum, m) => sum + m.amount, 0));
  const partsTotal = round2(principal + interestOutstanding);

  if (Math.abs(partsTotal - closingBalance) > TIE_OUT_TOLERANCE) {
    throw new SnapshotIntegrityError(upTo[0]?.loanId, asOf, closingBalance, partsTotal);
  }

  const oldestUnpaid = allocation.obligations.find((o) => o.remaining > 0);
  let nextDueDate: string | null = null;
  if (oldestUnpaid) {
    nextDueDate = oldestUnpaid.dueDate;
  } else if (principal > 0) {
    const thisMonthEnd = monthEndOf(asOf);
    nextDueDate = thisMonthEnd > asOf ? thisMonthEnd : nextMonthEndOf(asOf);
  }

  return {
    asOf,
    hasEntries: upTo.length > 0,
    bifurcation: allocation.closing,
    principalOutstanding: principal,
    interestOutstanding,
    totalPayable: partsTotal,
    closingBalance,
    amountOverdue: dpd.amountOverdue,
    dpd: dpd.dpdDays,
    classification: dpd.classification,
    oldestOverdueDueDate: dpd.oldestOverdueDueDate,
    nextDueDate,
    totalDisbursed: round2(totalDisbursed),
    totalReceived: round2(totalReceived),
    totalInterest: round2(totalInterest),
    totalTds: round2(totalTds),
    firstDisbursementDate,
    lastReceiptDate,
  };
}
