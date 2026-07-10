import type { ReportName } from "./types";

export type ColumnType = "text" | "currency" | "badge" | "date" | "number";

export interface ReportColumnDef {
  key: string;
  header: string;
  type: ColumnType;
}

export const REPORT_COLUMNS: Record<ReportName, ReportColumnDef[]> = {
  "loan-register": [
    { key: "loanNumber", header: "Loan Number", type: "text" },
    { key: "customerName", header: "Customer", type: "text" },
    { key: "loanAmount", header: "Loan Amount", type: "currency" },
    { key: "outstandingAmount", header: "Outstanding", type: "currency" },
    { key: "interestRate", header: "Interest Rate", type: "text" },
    { key: "status", header: "Status", type: "badge" },
    { key: "createdDate", header: "Created", type: "date" },
  ],
  "customer-report": [
    { key: "customerName", header: "Customer", type: "text" },
    { key: "phone", header: "Phone", type: "text" },
    { key: "email", header: "Email", type: "text" },
    { key: "totalLoans", header: "Total Loans", type: "number" },
    { key: "outstandingAmount", header: "Outstanding", type: "currency" },
  ],
  "collateral-report": [
    { key: "loanNumber", header: "Loan Number", type: "text" },
    { key: "collateralType", header: "Type", type: "badge" },
    { key: "marketValue", header: "Market Value", type: "currency" },
    { key: "ltv", header: "LTV %", type: "text" },
    { key: "insuranceStatus", header: "Insurance", type: "badge" },
  ],
  "collections-report": [
    { key: "loanNumber", header: "Loan Number", type: "text" },
    { key: "customerName", header: "Customer", type: "text" },
    { key: "collectionStatus", header: "Status", type: "badge" },
    { key: "promiseToPay", header: "Promise Amount", type: "currency" },
    { key: "nextFollowUp", header: "Next Follow-up", type: "date" },
    { key: "assignedUser", header: "Assigned To", type: "text" },
  ],
  "document-report": [
    { key: "documentName", header: "Document", type: "text" },
    { key: "entityType", header: "Owner Type", type: "badge" },
    { key: "entityId", header: "Owner Id", type: "text" },
    { key: "uploadedBy", header: "Uploaded By", type: "text" },
    { key: "uploadedAt", header: "Uploaded At", type: "date" },
    { key: "fileType", header: "File Type", type: "text" },
  ],
  "portfolio-summary": [
    { key: "totalLoans", header: "Total Loans", type: "number" },
    { key: "activeLoans", header: "Active", type: "number" },
    { key: "closedLoans", header: "Closed", type: "number" },
    { key: "rejectedLoans", header: "Rejected", type: "number" },
    { key: "totalPortfolioValue", header: "Portfolio Value", type: "currency" },
    { key: "outstandingAmount", header: "Outstanding", type: "currency" },
    { key: "averageLoanSize", header: "Avg. Loan Size", type: "currency" },
    { key: "averageInterestRate", header: "Avg. Interest Rate", type: "text" },
  ],
};
