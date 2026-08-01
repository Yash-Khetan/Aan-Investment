export const SECURITY_TYPES = [
  "PROPERTY",
  "MORTGAGE",
  "HYPOTHECATION_OF_RECEIVABLES",
  "PERSONAL_GUARANTEE",
  "CORPORATE_GUARANTEE",
  "OTHERS",
  "NONE",
] as const;

/** Fixed display/creation order for collateral security types (Mortgage directly followed by Hypothecation of Receivables). */
export const SECURITY_TYPE_ORDER: readonly string[] = SECURITY_TYPES.filter((t) => t !== "NONE");

/** The document type each security's upload tile is scoped to (documents attach at the loan level, filtered by this type). */
export const SECURITY_DOCUMENT_TYPE: Record<string, string> = {
  PROPERTY: "VALUATION_REPORT",
  MORTGAGE: "MORTGAGE_DEED",
  HYPOTHECATION_OF_RECEIVABLES: "HYPOTHECATION_DEED",
  PERSONAL_GUARANTEE: "PERSONAL_GUARANTEE",
  CORPORATE_GUARANTEE: "CORPORATE_GUARANTEE",
  OTHERS: "OTHER",
};

export interface InsuranceRecord {
  id: string;
  collateralId: string;
  policyNumber: string;
  insurer: string | null;
  insuredAmount: string | null;
  premiumAmount: string | null;
  startDate: string | null;
  expiryDate: string | null;
  status: string | null;
}

export interface CollateralRecord {
  id: string;
  loanId: string;
  securityType: string;
  otherSecurityType: string | null;
  description: string | null;
  propertyType: string | null;
  propertyAddress: string | null;
  surveyNumber: string | null;
  areaInSqFt: string | null;
  estimatedValue: string | null;
  valuationDate: string | null;
  valuationBy: string | null;
  mortgageType: string | null;
  mortgageDate: string | null;
  mortgageDeedNumber: string | null;
  ltvRatio: string | null;
  status: string | null;
  remarks: string | null;
  insurance: InsuranceRecord | null;
  createdAt: string | null;
}

export interface CreateCollateralInput {
  loanId: string;
  securityType: string;
  otherSecurityType?: string;
  description?: string;
  propertyType?: string;
  propertyAddress?: string;
  surveyNumber?: string;
  areaInSqFt?: number;
  estimatedValue: number;
  valuationDate?: string;
  valuationBy?: string;
  mortgageType?: string;
  mortgageDate?: string;
  mortgageDeedNumber?: string;
  remarks?: string;
}

export interface UpdateValuationInput {
  estimatedValue: number;
  valuationDate?: string;
  valuationBy?: string;
}

export interface UpdateInsuranceInput {
  policyNumber: string;
  insurer?: string;
  insuredAmount?: number;
  premiumAmount?: number;
  startDate?: string;
  expiryDate?: string;
}

export interface LtvResult {
  collateralId: string;
  loanId: string;
  loanOutstanding: string;
  marketValue: string;
  ltvPercentage: number;
}
