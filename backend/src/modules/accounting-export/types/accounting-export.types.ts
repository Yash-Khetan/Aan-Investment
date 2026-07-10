/* ============================================================
   TRANSACTION TYPES
============================================================ */

export const TRANSACTION_TYPES = [
    "PRINCIPAL_RECEIVED",
    "INTEREST_RECEIVED",
    "PENALTY_CHARGES",
    "LOAN_DISBURSEMENT",
    "LOAN_CLOSURE",
    "LOAN_WRITE_OFF",
    "REFUND",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/* ============================================================
   EXPORT FORMATS
============================================================ */

export const EXPORT_FORMATS = ["json", "csv", "xlsx"] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/* ============================================================
   ACCOUNTING ENTRY ROW
   Canonical shape emitted by every getX Entries() method and
   consumed by every exporter.
============================================================ */

export interface AccountingEntryRow {
    transactionDate: string;
    loanNumber: string;
    customerName: string;
    transactionType: TransactionType;
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

/* ============================================================
   FILTERS
============================================================ */

export interface AccountingExportFilters {
    branchId?: string;
    loanId?: string;
    customerId?: string;
    transactionType?: TransactionType;
    startDate?: string;
    endDate?: string;
}

/* ============================================================
   EXPORT RESULT META
============================================================ */

export interface AccountingExportResult {
    rows: AccountingEntryRow[];
    count: number;
    generatedAt: string;
    filters: AccountingExportFilters;
    notes?: string;
}
