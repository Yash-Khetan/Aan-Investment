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
