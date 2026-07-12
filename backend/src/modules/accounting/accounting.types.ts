export type JournalEntryType =
  | "DISBURSEMENT"
  | "INTEREST_ACCRUAL"
  | "INTEREST_RECEIPT"
  | "PRINCIPAL_RECEIPT"
  | "PENAL_INTEREST"
  | "WRITE_OFF";

export interface CreateJournalEntryInput {
  loanId?: string;
  paymentId?: string;
  entryType: JournalEntryType;
  entryDate: string;
  amount: number;
  narration?: string;
}