import type {
    ReportColumn,
    LoanRegisterRow,
    CustomerReportRow,
    CollateralReportRow,
    CollectionsReportRow,
    DocumentReportRow,
    PortfolioSummaryRow,
} from "../types/report.types";

/* ============================================================
   REPORT DISPLAY NAMES
============================================================ */

export const REPORT_TITLES: Record<string, string> = {
    "loan-register": "Loan Register",
    "customer-report": "Customer Report",
    "collateral-report": "Collateral Report",
    "collections-report": "Collections Report",
    "document-report": "Document Report",
    "portfolio-summary": "Portfolio Summary Report",
};

/* ============================================================
   EXPORT COLUMN DEFINITIONS
   Defines exact column order + header labels for CSV / Excel
   exports, matching the module specification field-for-field.
============================================================ */

export const LOAN_REGISTER_COLUMNS: ReportColumn<LoanRegisterRow>[] = [
    { key: "loanNumber", label: "Loan Number" },
    { key: "customerName", label: "Customer Name" },
    { key: "loanAmount", label: "Loan Amount" },
    { key: "outstandingAmount", label: "Outstanding Amount" },
    { key: "interestRate", label: "Interest Rate" },
    { key: "status", label: "Status" },
    { key: "createdDate", label: "Created Date" },
];

export const CUSTOMER_REPORT_COLUMNS: ReportColumn<CustomerReportRow>[] = [
    { key: "customerId", label: "Customer ID" },
    { key: "customerName", label: "Customer Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "totalLoans", label: "Total Loans" },
    { key: "outstandingAmount", label: "Outstanding Amount" },
];

export const COLLATERAL_REPORT_COLUMNS: ReportColumn<CollateralReportRow>[] = [
    { key: "collateralType", label: "Collateral Type" },
    { key: "loanNumber", label: "Loan Number" },
    { key: "marketValue", label: "Market Value" },
    { key: "forcedSaleValue", label: "Forced Sale Value" },
    { key: "ltv", label: "LTV" },
    { key: "insuranceStatus", label: "Insurance Status" },
];

export const COLLECTIONS_REPORT_COLUMNS: ReportColumn<CollectionsReportRow>[] = [
    { key: "loanNumber", label: "Loan Number" },
    { key: "customerName", label: "Customer Name" },
    { key: "collectionStatus", label: "Collection Status" },
    { key: "promiseToPay", label: "Promise To Pay" },
    { key: "nextFollowUp", label: "Next Follow-up" },
    { key: "assignedUser", label: "Assigned User" },
];

export const DOCUMENT_REPORT_COLUMNS: ReportColumn<DocumentReportRow>[] = [
    { key: "documentName", label: "Document Name" },
    { key: "entityType", label: "Entity Type" },
    { key: "entityId", label: "Entity ID" },
    { key: "uploadedBy", label: "Uploaded By" },
    { key: "uploadedAt", label: "Uploaded At" },
    { key: "fileType", label: "File Type" },
];

export const PORTFOLIO_SUMMARY_COLUMNS: ReportColumn<PortfolioSummaryRow>[] = [
    { key: "totalLoans", label: "Total Loans" },
    { key: "activeLoans", label: "Active Loans" },
    { key: "closedLoans", label: "Closed Loans" },
    { key: "rejectedLoans", label: "Rejected Loans" },
    { key: "totalPortfolioValue", label: "Total Portfolio Value" },
    { key: "outstandingAmount", label: "Outstanding Amount" },
    { key: "averageLoanSize", label: "Average Loan Size" },
    { key: "averageInterestRate", label: "Average Interest Rate" },
];

/* ============================================================
   MISC
============================================================ */

export const MAX_DATE_RANGE_DAYS = 366 * 5;
