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
