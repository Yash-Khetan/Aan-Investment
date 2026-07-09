import type {
    loanStatusEnum,
    securityTypeEnum,
    collectionStatusEnum,
    documentOwnerEnum,
} from "../../../db/schema";

/* ============================================================
   ENUM-DERIVED TYPES
============================================================ */

export type LoanStatus = (typeof loanStatusEnum.enumValues)[number];
export type SecurityType = (typeof securityTypeEnum.enumValues)[number];
export type CollectionStatus = (typeof collectionStatusEnum.enumValues)[number];
export type DocumentOwnerType = (typeof documentOwnerEnum.enumValues)[number];

export type InsuranceStatus = "NOT_INSURED" | "ACTIVE" | "EXPIRED" | "INACTIVE";

/* ============================================================
   REPORT / EXPORT IDENTIFIERS
============================================================ */

export const REPORT_NAMES = [
    "loan-register",
    "customer-report",
    "collateral-report",
    "collections-report",
    "document-report",
    "portfolio-summary",
] as const;

export type ReportName = (typeof REPORT_NAMES)[number];

export const EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/* ============================================================
   FILTERS
============================================================ */

export interface ReportFilters {
    branchId?: string;
    loanStatus?: LoanStatus;
    customerId?: string;
    startDate?: string;
    endDate?: string;
    collateralType?: SecurityType;
    collectionStatus?: CollectionStatus;
}

/* ============================================================
   REPORT ROW SHAPES
============================================================ */

export interface LoanRegisterRow {
    loanNumber: string;
    customerName: string;
    loanAmount: string;
    outstandingAmount: string;
    interestRate: string;
    status: LoanStatus | null;
    createdDate: string | null;
}

export interface CustomerReportRow {
    customerId: string;
    customerName: string;
    phone: string | null;
    email: string | null;
    totalLoans: number;
    outstandingAmount: string;
}

export interface CollateralReportRow {
    collateralType: SecurityType;
    loanNumber: string;
    marketValue: string | null;
    forcedSaleValue: null;
    ltv: string | null;
    insuranceStatus: InsuranceStatus;
}

export interface CollectionsReportRow {
    loanNumber: string;
    customerName: string;
    collectionStatus: CollectionStatus | null;
    promiseToPay: string | null;
    nextFollowUp: string | null;
    assignedUser: string | null;
}

export interface DocumentReportRow {
    documentName: string;
    entityType: DocumentOwnerType;
    entityId: string;
    uploadedBy: string | null;
    uploadedAt: string | null;
    fileType: string | null;
}

export interface PortfolioSummaryRow {
    totalLoans: number;
    activeLoans: number;
    closedLoans: number;
    rejectedLoans: number;
    totalPortfolioValue: string;
    outstandingAmount: string;
    averageLoanSize: string;
    averageInterestRate: string;
}

export type ReportRow =
    | LoanRegisterRow
    | CustomerReportRow
    | CollateralReportRow
    | CollectionsReportRow
    | DocumentReportRow
    | PortfolioSummaryRow;

/* ============================================================
   COLUMN DEFINITIONS (used to drive CSV / Excel export)
============================================================ */

export interface ReportColumn<T> {
    key: keyof T & string;
    label: string;
}
