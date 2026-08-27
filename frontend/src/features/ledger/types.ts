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
  /** Computed cumulative running balance, attached server-side — never independently stored. */
  balance: number;
}

/** The loan's own Interest/TDS rates. Saving these writes straight to the loan record. */
export interface LedgerSettings {
  loanId: string;
  defaultInterestRatePercent: string;
  defaultTdsRatePercent: string;
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

export interface UpdateSettingsInput {
  defaultInterestRatePercent: number;
  defaultTdsRatePercent: number;
}
