import type { TransactionType } from "../types/accounting-export.types.js";

/* ============================================================
   EXPORT CATEGORIES
   Maps the URL slug used in routes (/accounting/:slug and
   /accounting/export/:slug) to the transaction type it
   represents and the AccountingExportService method that
   produces it.
============================================================ */

export type ExportCategorySlug =
    | "principal"
    | "interest"
    | "penalties"
    | "disbursements"
    | "closures"
    | "write-offs"
    | "refunds";

export interface ExportCategoryConfig {
    slug: ExportCategorySlug;
    transactionType: TransactionType;
    label: string;
    serviceMethod:
        | "getPrincipalEntries"
        | "getInterestEntries"
        | "getPenaltyEntries"
        | "getLoanDisbursements"
        | "getLoanClosures"
        | "getWriteOffEntries"
        | "getRefundEntries";
}

export const EXPORT_CATEGORIES: Record<ExportCategorySlug, ExportCategoryConfig> = {
    principal: {
        slug: "principal",
        transactionType: "PRINCIPAL_RECEIVED",
        label: "Principal Received",
        serviceMethod: "getPrincipalEntries",
    },
    interest: {
        slug: "interest",
        transactionType: "INTEREST_RECEIVED",
        label: "Interest Received",
        serviceMethod: "getInterestEntries",
    },
    penalties: {
        slug: "penalties",
        transactionType: "PENALTY_CHARGES",
        label: "Penalty Charges",
        serviceMethod: "getPenaltyEntries",
    },
    disbursements: {
        slug: "disbursements",
        transactionType: "LOAN_DISBURSEMENT",
        label: "Loan Disbursement",
        serviceMethod: "getLoanDisbursements",
    },
    closures: {
        slug: "closures",
        transactionType: "LOAN_CLOSURE",
        label: "Loan Closure",
        serviceMethod: "getLoanClosures",
    },
    "write-offs": {
        slug: "write-offs",
        transactionType: "LOAN_WRITE_OFF",
        label: "Loan Write-Off",
        serviceMethod: "getWriteOffEntries",
    },
    refunds: {
        slug: "refunds",
        transactionType: "REFUND",
        label: "Refund",
        serviceMethod: "getRefundEntries",
    },
};

export const EXPORT_CATEGORY_SLUGS = Object.keys(
    EXPORT_CATEGORIES,
) as ExportCategorySlug[];
