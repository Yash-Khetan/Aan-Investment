export const JOURNAL_ENTRY_TYPES = [
  "DISBURSEMENT",
  "INTEREST_ACCRUAL",
  "INTEREST_RECEIPT",
  "PRINCIPAL_RECEIPT",
  "PENAL_INTEREST",
  "WRITE_OFF",
] as const;

export type JournalEntryType = (typeof JOURNAL_ENTRY_TYPES)[number];

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountCode: string;
  accountName: string | null;
  debitAmount: string;
  creditAmount: string;
  narration: string | null;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  loanId: string | null;
  paymentId: string | null;
  entryType: JournalEntryType;
  entryDate: string;
  narration: string | null;
  isPosted: boolean;
  isExported: boolean;
  createdAt: string;
  lines: JournalEntryLine[];
}

export interface RecordDisbursementInput {
  loanId: string;
  amount: number;
  entryDate: string;
}

export interface RecordWriteOffInput {
  loanId: string;
  amount: number;
  entryDate: string;
}
