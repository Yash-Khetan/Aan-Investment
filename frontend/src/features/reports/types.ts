export const REPORT_NAMES = [
  "loan-register",
  "customer-report",
  "collateral-report",
  "collections-report",
  "document-report",
  "portfolio-summary",
] as const;

export type ReportName = (typeof REPORT_NAMES)[number];

export const REPORT_LABELS: Record<ReportName, string> = {
  "loan-register": "Loan Register",
  "customer-report": "Customer Report",
  "collateral-report": "Collateral Report",
  "collections-report": "Collections Report",
  "document-report": "Document Report",
  "portfolio-summary": "Portfolio Summary",
};

export interface ReportFilters {
  loanStatus?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  collateralType?: string;
  collectionStatus?: string;
}

export interface ReportResponse<T> {
  success: boolean;
  report: string;
  generatedAt: string;
  count: number;
  data: T[];
}

export type ReportRow = Record<string, string | number | null>;
