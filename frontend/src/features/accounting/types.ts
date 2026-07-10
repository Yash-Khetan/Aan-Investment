export const ACCOUNTING_CATEGORIES = [
  "principal",
  "interest",
  "penalties",
  "disbursements",
  "closures",
  "write-offs",
  "refunds",
] as const;

export type AccountingCategory = (typeof ACCOUNTING_CATEGORIES)[number];

export const ACCOUNTING_CATEGORY_LABELS: Record<AccountingCategory, string> = {
  principal: "Principal Received",
  interest: "Interest Received",
  penalties: "Penalty Charges",
  disbursements: "Loan Disbursement",
  closures: "Loan Closure",
  "write-offs": "Loan Write-Off",
  refunds: "Refunds",
};

export interface AccountingEntryRow {
  transactionDate: string;
  loanNumber: string;
  customerName: string;
  transactionType: string;
  referenceNumber: string;
  debitAccount: string;
  creditAccount: string;
  principalAmount: number;
  interestAmount: number;
  penaltyAmount: number;
  fees: number;
  taxAmount: number;
  totalAmount: number;
  remarks: string;
  createdAt: string;
}

export interface AccountingFilters {
  loanId?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AccountingResponse {
  success: boolean;
  count: number;
  generatedAt: string;
  filters: AccountingFilters;
  notes?: string;
  data: AccountingEntryRow[];
}
