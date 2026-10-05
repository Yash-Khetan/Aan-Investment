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
  /** What `balance` is made of right after this entry: principal plus each month's unpaid net interest. */
  bifurcation: BalanceBifurcation;
  /** On a Receipt, how it was appropriated — interest oldest month first, then principal. Null on every other row. */
  allocation: ReceiptAllocation | null;
}

/**
 * A ledger balance split into principal and each accrual month's interest
 * (net of TDS) still unpaid. The parts always add up to the balance.
 */
export interface BalanceBifurcation {
  /** Negative only when receipts have paid back more than was lent. */
  principal: number;
  /** Oldest first; fully-paid months are left out. `month` is the first of the accrual month, YYYY-MM-DD. */
  interest: Array<{ month: string; amount: number }>;
}

export interface ReceiptAllocation {
  /** `cleared` is true when this receipt finished paying off the month. */
  interest: Array<{ month: string; amount: number; cleared: boolean }>;
  principal: number;
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

/** RBI asset classification, derived from DPD: STD 0, SMA-0 1-30, SMA-1 31-60, SMA-2 61-90, NPA 90+. */
export type DpdClassification = "STD" | "SMA-0" | "SMA-1" | "SMA-2" | "NPA";

export interface DpdMonth {
  /** Days past due as at this month's end (as at today, for the month in progress). Part-payments count proportionally. */
  dpd: number;
  classification: DpdClassification;
  /** Balance: net interest already past due by then and still not received, in rupees. */
  amountOverdue: number;
  /** The month still in progress - its figure is still moving. */
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
  current: {
    dpd: number;
    classification: DpdClassification;
    amountOverdue: number;
    oldestOverdueDueDate: string | null;
  } | null;
  worstDpd: number;
}
