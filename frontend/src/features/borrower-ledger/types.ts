export type LedgerVchType = "PAYMENT" | "RECEIPT" | "JOURNAL_INTEREST" | "JOURNAL_TDS";

export interface LedgerEntry {
  id: string;
  borrowerId: string;
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

export interface LedgerSettings {
  borrowerId: string;
  defaultInterestRatePercent: string;
  defaultTdsRatePercent: string;
}

export interface BorrowerLedger {
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
