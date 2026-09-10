import type { InterestBasis } from "../interest/interest.types";

export type LedgerVchType = "PAYMENT" | "RECEIPT" | "JOURNAL_INTEREST" | "JOURNAL_TDS";

export interface CreateLedgerEntryInput {
  loanId: string;
  entryDate: string;
  vchType: "PAYMENT" | "RECEIPT";
  amount: number;
  narration?: string;
}

/**
 * The interest configuration one month accrues under, resolved from the Loan
 * module and its effective-dated interest configuration. The ledger reads
 * this; it never writes any part of it.
 */
export interface MonthAccrualConfig {
  interestRatePercent: number;
  tdsRatePercent: number;
  /** Day-count basis, e.g. ACTUAL_365. Only bases with a daily-rate concept reach here. */
  interestBasis: InterestBasis;
  includeOpeningClosingDays: boolean;
}

/** A single balance-changing event on the loan's ledger timeline, used by the Running Balance Method. */
export interface LedgerBalanceEvent {
  date: Date;
  /** Positive for Payment/Journal-Interest, negative for Receipt/Journal-TDS. */
  delta: number;
}

/* ============================================================
   DPD HISTORY

   The Ledger's month-by-month Days Past Due grid for one loan.
   A null month is "X" - outside the loan's life, which is not
   the same as a month with nothing overdue (0).
============================================================ */

export interface DpdMonth {
  /** Days past due as at this month's end. */
  dpd: number;
  /** Whole 30-day periods past due: floor(dpd / 30). */
  bucket: number;
  amountOverdue: number;
  /** True for the month still in progress, whose figure is derived, not frozen. */
  isCurrentMonth: boolean;
}

export interface DpdYearRow {
  year: number;
  /** Twelve entries, Jan..Dec. Null renders as "X". */
  months: Array<DpdMonth | null>;
}

export interface DpdGrid {
  loanId: string;
  years: DpdYearRow[];
  /** Live figure as of today, for the summary line. Null when the loan has no start date. */
  current: {
    dpd: number;
    bucket: number;
    amountOverdue: number;
    oldestOverdueDueDate: string | null;
  } | null;
  /** Highest DPD the loan has ever reached. */
  worstDpd: number;
}
