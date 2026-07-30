import { securityTypeEnum, entityStatusEnum } from "../../../db/schema";
import { isValidDateString } from "../utils/date.util";
import { ValidationError, InvalidCollateralTypeError } from "../utils/errors";
import type { CollateralType, CollateralStatus, CreateCollateralInput, UpdateInsuranceInput } from "../types/collateral.types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertValidUuid(value: string, fieldName: string): void {
    if (!value || !UUID_REGEX.test(value)) {
        throw new ValidationError(`Invalid ${fieldName} "${value}". Must be a valid UUID.`);
    }
}

export function assertValidCollateralType(securityType: string): asserts securityType is CollateralType {
    if (!securityTypeEnum.enumValues.includes(securityType as CollateralType)) {
        throw new InvalidCollateralTypeError(
            `Invalid collateral type "${securityType}". Must be one of: ${securityTypeEnum.enumValues.join(", ")}.`
        );
    }
}

/** securityType "OTHERS" requires a free-text label; every other value must leave it unset. */
export function assertValidOtherSecurityType(securityType: string, otherSecurityType?: string): void {
    if (securityType === "OTHERS" && !otherSecurityType?.trim()) {
        throw new ValidationError("otherSecurityType is required when securityType is OTHERS.");
    }

    if (securityType !== "OTHERS" && otherSecurityType) {
        throw new ValidationError("otherSecurityType may only be set when securityType is OTHERS.");
    }
}

export function assertValidCollateralStatus(status: string): asserts status is CollateralStatus {
    if (!entityStatusEnum.enumValues.includes(status as CollateralStatus)) {
        throw new ValidationError(
            `Invalid status "${status}". Must be one of: ${entityStatusEnum.enumValues.join(", ")}.`
        );
    }
}

export function assertNonNegativeAmount(value: number | string, fieldName: string): void {
    const numeric = Number(value);
    if (value === undefined || value === null || value === "" || !Number.isFinite(numeric)) {
        throw new ValidationError(`${fieldName} must be a valid number.`);
    }

    if (numeric < 0) {
        throw new ValidationError(`${fieldName} cannot be negative.`);
    }
}

export function assertValidDate(value: string, fieldName: string): void {
    if (!isValidDateString(value)) {
        throw new ValidationError(`Invalid ${fieldName} "${value}". Must be a valid date.`);
    }
}

/** Validates the required fields for creating a collateral: loanId, type, market value, valuation date. */
export function assertValidCreateInput(input: CreateCollateralInput): void {
    if (!input.loanId) {
        throw new ValidationError("loanId is required.");
    }
    assertValidUuid(input.loanId, "loanId");

    if (!input.securityType) {
        throw new ValidationError("securityType is required.");
    }
    assertValidCollateralType(input.securityType);
    assertValidOtherSecurityType(input.securityType, input.otherSecurityType);

    if (input.estimatedValue === undefined || input.estimatedValue === null) {
        throw new ValidationError("estimatedValue is required.");
    }
    assertNonNegativeAmount(input.estimatedValue, "estimatedValue");

    if (input.valuationDate !== undefined) {
        assertValidDate(input.valuationDate, "valuationDate");
    }

    if (input.areaInSqFt !== undefined) {
        assertNonNegativeAmount(input.areaInSqFt, "areaInSqFt");
    }

    if (input.ownerId !== undefined) {
        assertValidUuid(input.ownerId, "ownerId");
    }

    if (input.mortgageDate !== undefined) {
        assertValidDate(input.mortgageDate, "mortgageDate");
    }

    if (input.status !== undefined) {
        assertValidCollateralStatus(input.status);
    }
}

/** Validates the insurance payload used by CollateralService.updateInsurance. */
export function assertValidInsuranceInput(input: UpdateInsuranceInput): void {
    if (!input.policyNumber || !input.policyNumber.trim()) {
        throw new ValidationError("policyNumber is required.");
    }

    if (input.insuredAmount !== undefined) {
        assertNonNegativeAmount(input.insuredAmount, "insuredAmount");
    }

    if (input.premiumAmount !== undefined) {
        assertNonNegativeAmount(input.premiumAmount, "premiumAmount");
    }

    if (input.startDate !== undefined) {
        assertValidDate(input.startDate, "startDate");
    }

    if (input.expiryDate !== undefined) {
        assertValidDate(input.expiryDate, "expiryDate");
    }
}
