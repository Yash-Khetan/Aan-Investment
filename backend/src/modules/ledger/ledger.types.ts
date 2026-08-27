export type LedgerVchType = "PAYMENT" | "RECEIPT" | "JOURNAL_INTEREST" | "JOURNAL_TDS";

export interface CreateLedgerEntryInput {
  loanId: string;
  entryDate: string;
  vchType: "PAYMENT" | "RECEIPT";
  amount: number;
  narration?: string;
}

/** Both values are written straight to the loan row — the ledger keeps no rates of its own. */
export interface UpdateLedgerSettingsInput {
  defaultInterestRatePercent: number;
  defaultTdsRatePercent: number;
}

/** A single balance-changing event on the loan's ledger timeline, used by the Running Balance Method. */
export interface LedgerBalanceEvent {
  date: Date;
  /** Positive for Payment/Journal-Interest, negative for Receipt/Journal-TDS. */
  delta: number;
}
