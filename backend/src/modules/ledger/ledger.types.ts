import type { LoanClassification } from "./dpd";
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
   BALANCE BIFURCATION

   What a ledger balance is made of: principal, plus each accrual
   month's interest (net of TDS) still unpaid. See allocation.ts.
============================================================ */

export interface BalanceBifurcation {
  /** Principal outstanding. Negative only when receipts have paid back more than was lent. */
  principal: number;
  /** Unpaid net interest per accrual month, oldest first. Months fully paid are left out. */
  interest: Array<{
    /** First of the accrual month, YYYY-MM-DD. */
    month: string;
    amount: number;
  }>;
}

/** How one Receipt was appropriated: interest oldest month first, then principal with whatever is left. */
export interface ReceiptAllocation {
  interest: Array<{
    month: string;
    amount: number;
    /** True when this receipt finished paying off the month. */
    cleared: boolean;
  }>;
  principal: number;
}

/* ============================================================
   DPD HISTORY

   The Ledger's month-by-month Days Past Due grid for one loan,
   measured against the ledger's own month-end Interest journals.
   A null month is "X" - before the loan's first entry, or not
   yet reached - which is not the same as a month with nothing
   overdue (0).
============================================================ */

export interface DpdMonth {
  /**
   * Days past due as at this month's end (as at today, for the month in
   * progress). A part-paid obligation counts in proportion to what is still
   * unpaid on it. See dpd.service.ts.
   */
  dpd: number;
  /** RBI asset classification for that DPD: STD, SMA-0, SMA-1, SMA-2 or NPA. */
  classification: LoanClassification;
  /** Balance: net interest already past due by then and still not received, in rupees. */
  amountOverdue: number;
  /** True for the month still in progress, whose figure is still moving. */
  isCurrentMonth: boolean;
}

export interface DpdYearRow {
  year: number;
  /** Twelve entries, Jan..Dec. Null renders as "X". */
  months: Array<DpdMonth | null>;
}

export interface DpdGrid {
  loanId: string;
  /** One row per year from the loan's first ledger entry to its maturity. Empty when the ledger is. */
  years: DpdYearRow[];
  /** Live figure as of today. Null when the ledger has no entries yet. */
  current: {
    dpd: number;
    classification: LoanClassification;
    amountOverdue: number;
    oldestOverdueDueDate: string | null;
  } | null;
  /** Highest DPD on the grid. */
  worstDpd: number;
}
