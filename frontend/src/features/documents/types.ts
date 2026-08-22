export const ENTITY_TYPES = ["LOAN", "BORROWER"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Document types selectable from the generic Documents tab dropdown. Types
 * that belong to a specific collateral/security (MORTGAGE_DEED,
 * HYPOTHECATION_DEED, PERSONAL_GUARANTEE, CORPORATE_GUARANTEE,
 * VALUATION_REPORT) are deliberately excluded — those are uploaded from their
 * own tile on the Security / Collateral page (see SECURITY_DOCUMENT_TYPE),
 * scoped to a loan that's SECURED. An unsecured loan has no collateral
 * documents to begin with, so surfacing them here would just be redundant.
 */
export const DOCUMENT_TYPES = [
  "SANCTION_LETTER",
  "LOAN_AGREEMENT",
  "DPN",
  "BOARD_RESOLUTION",
  "LEGAL_OPINION",
  "INSURANCE",
  "KYC",
  "PAN_CARD",
  "GSTIN_CERTIFICATE",
  "AADHAAR",
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
