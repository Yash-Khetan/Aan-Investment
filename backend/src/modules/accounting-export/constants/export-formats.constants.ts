import type { ExportFormat } from "../types/accounting-export.types.js";

/* ============================================================
   EXPORT FORMAT METADATA
============================================================ */

export const EXPORT_FORMAT_META: Record<
    Exclude<ExportFormat, "json">,
    { contentType: string; extension: string }
> = {
    csv: {
        contentType: "text/csv; charset=utf-8",
        extension: "csv",
    },
    xlsx: {
        contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
    },
};

/* ============================================================
   ACCOUNTING ENTRY ROW -> COLUMN DEFINITIONS
   Shared between the CSV and Excel exporters so both formats
   always render the exact same column set, order, and headers.
============================================================ */

export const ACCOUNTING_ENTRY_COLUMNS: Array<{
    key:
        | "transactionDate"
        | "loanNumber"
        | "customerName"
        | "transactionType"
        | "referenceNumber"
        | "debitAccount"
        | "creditAccount"
        | "principalAmount"
        | "interestAmount"
        | "penaltyAmount"
        | "fees"
        | "taxAmount"
        | "totalAmount"
        | "remarks"
        | "createdAt";
    header: string;
}> = [
    { key: "transactionDate", header: "Transaction Date" },
    { key: "loanNumber", header: "Loan Number" },
    { key: "customerName", header: "Customer Name" },
    { key: "transactionType", header: "Transaction Type" },
    { key: "referenceNumber", header: "Reference Number" },
    { key: "debitAccount", header: "Debit Account" },
    { key: "creditAccount", header: "Credit Account" },
    { key: "principalAmount", header: "Principal Amount" },
    { key: "interestAmount", header: "Interest Amount" },
    { key: "penaltyAmount", header: "Penalty Amount" },
    { key: "fees", header: "Fees" },
    { key: "taxAmount", header: "Tax Amount" },
    { key: "totalAmount", header: "Total Amount" },
    { key: "remarks", header: "Remarks" },
    { key: "createdAt", header: "Created At" },
];
