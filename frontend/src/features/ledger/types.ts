export type LedgerVchType = "PAYMENT" | "RECEIPT" | "JOURNAL_INTEREST" | "JOURNAL_TDS";

export interface LedgerEntry {
  id: string;
  loanId: string;
  entryDate: string;
  narration: string | null;
  vchType: LedgerVchType;
  vchNo: string;
  debit: string | null;
  credit: string | null;
  pairedEntryId: string | null;
  accrualMonth: string | null;
  ratePercent: string | null;
  isSystemGenerated: boolean;
  /** Day-count basis this entry was accrued under. Null on rows posted before it was snapshotted. */
  interestBasis: string | null;
  includeOpeningClosingDays: boolean | null;
  /** Computed cumulative running balance, attached server-side — never independently stored. */
  balance: number;
}

/**
 * The interest configuration this ledger is accruing at, read from the Loan
 * module. Display only — there is no write path back from the Ledger.
 */
export interface LedgerSettings {
  loanId: string;
  /** The loan row's own rates. */
  defaultInterestRatePercent: string;
  defaultTdsRatePercent: string;
  /** The rates and day-count actually in effect today, from the current interest configuration. */
  currentInterestRatePercent: string;
  currentTdsRatePercent: string;
  interestBasis: string;
  includeOpeningClosingDays: boolean;
}

export interface LoanLedger {
  entries: LedgerEntry[];
  settings: LedgerSettings;
}

export interface CreateEntryInput {
  entryDate: string;
  vchType: "PAYMENT" | "RECEIPT";
  amount: number;
  narration?: string;
}

/* ------------------------------------------------------------------ */
/* DPD history                                                         */
/*                                                                     */
/* Month-by-month Days Past Due for one loan. A null month is "X" -    */
/* outside the loan's life, which is not the same as a month with      */
/* nothing overdue (0).                                                */
/* ------------------------------------------------------------------ */

export interface DpdMonth {
  dpd: number;
  /** Whole 30-day periods past due: floor(dpd / 30). */
  bucket: number;
  amountOverdue: number;
  /** The month still in progress - derived, not yet frozen. */
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
  current: {
    dpd: number;
    bucket: number;
    amountOverdue: number;
    oldestOverdueDueDate: string | null;
  } | null;
  worstDpd: number;
}
