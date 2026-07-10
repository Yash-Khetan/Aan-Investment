import { securityTypeEnum, entityStatusEnum } from "../../../db/schema";

/**
 * The set of collateral types. Sourced directly from the `security_type`
 * Postgres enum so this can never drift out of sync with the schema.
 * Adding a genuinely new type (e.g. "VEHICLE") requires a migration on
 * that enum — this module cannot invent one.
 */
export type CollateralType = (typeof securityTypeEnum.enumValues)[number];

/** Sourced from the `entity_status` Postgres enum: ACTIVE | INACTIVE. */
export type CollateralStatus = (typeof entityStatusEnum.enumValues)[number];

export interface CreateCollateralInput {
    loanId: string;
    ownerId?: string;
    securityType: CollateralType;
    description?: string;

    propertyType?: string;
    propertyAddress?: string;
    surveyNumber?: string;
    areaInSqFt?: number | string;

    estimatedValue: number | string;
    valuationDate?: string;
    valuationBy?: string;

    mortgageType?: string;
    mortgageDate?: string;
    mortgageDeedNumber?: string;

    status?: CollateralStatus;
    remarks?: string;
}

export interface UpdateCollateralInput {
    ownerId?: string;
    securityType?: CollateralType;
    description?: string;

    propertyType?: string;
    propertyAddress?: string;
    surveyNumber?: string;
    areaInSqFt?: number | string;

    estimatedValue?: number | string;
    valuationDate?: string;
    valuationBy?: string;

    mortgageType?: string;
    mortgageDate?: string;
    mortgageDeedNumber?: string;

    status?: CollateralStatus;
    remarks?: string;
}

export interface UpdateValuationInput {
    estimatedValue: number | string;
    valuationDate?: string;
    valuationBy?: string;
}

export interface UpdateInsuranceInput {
    policyNumber: string;
    insurer?: string;
    insuredAmount?: number | string;
    premiumAmount?: number | string;
    startDate?: string;
    expiryDate?: string;
}

export interface InsuranceRecord {
    id: string;
    collateralId: string;
    policyNumber: string;
    insurer: string | null;
    insuredAmount: string | null;
    premiumAmount: string | null;
    startDate: string | null;
    expiryDate: string | null;
    status: CollateralStatus | null;
    createdAt: Date | null;
    updatedAt: Date | null;
}

export interface CollateralRecord {
    id: string;
    loanId: string;
    ownerId: string | null;
    securityType: CollateralType;
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

    status: CollateralStatus | null;
    remarks: string | null;

    insurance: InsuranceRecord | null;

    createdAt: Date | null;
    updatedAt: Date | null;
}

export interface LtvResult {
    collateralId: string;
    loanId: string;
    loanOutstanding: string;
    marketValue: string;
    ltvPercentage: number;
}
