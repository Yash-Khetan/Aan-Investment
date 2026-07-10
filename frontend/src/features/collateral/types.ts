export const SECURITY_TYPES = [
  "PROPERTY",
  "MORTGAGE",
  "STRUCTURED_CREDIT",
  "PERSONAL_GUARANTEE",
  "CORPORATE_GUARANTEE",
  "NONE",
] as const;

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
