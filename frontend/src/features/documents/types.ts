export const ENTITY_TYPES = ["LOAN", "BORROWER"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const DOCUMENT_TYPES = [
  "SANCTION_LETTER",
  "LOAN_AGREEMENT",
  "MORTGAGE_DEED",
  "DPN",
  "BOARD_RESOLUTION",
  "PERSONAL_GUARANTEE",
  "CORPORATE_GUARANTEE",
  "LEGAL_OPINION",
  "VALUATION_REPORT",
  "INSURANCE",
  "KYC",
  "FINANCIAL_STATEMENT",
  "OTHER",
] as const;

export interface DocumentMetadata {
  id: string;
  entityType: string;
  entityId: string;
  documentType: string;
  name: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  isVerified: boolean | null;
  remarks: string | null;
  createdAt: string | null;
}
