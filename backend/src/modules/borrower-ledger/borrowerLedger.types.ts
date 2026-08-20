export type LedgerVchType = "PAYMENT" | "RECEIPT" | "JOURNAL_INTEREST" | "JOURNAL_TDS";

export interface CreateLedgerEntryInput {
  borrowerId: string;
  entryDate: string;
  vchType: "PAYMENT" | "RECEIPT";
  amount: number;
  narration?: string;
}

export interface UpdateLedgerSettingsInput {
  defaultInterestRatePercent: number;
  defaultTdsRatePercent: number;
}

/** A single balance-changing event on the borrower's ledger timeline, used by the Running Balance Method. */
export interface LedgerBalanceEvent {
  date: Date;
  /** Positive for Payment/Journal-Interest, negative for Receipt/Journal-TDS. */
  delta: number;
}
