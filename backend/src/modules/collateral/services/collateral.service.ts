import { and, eq, isNull, inArray } from "drizzle-orm";
import { db } from "../../../db";
import { collaterals, collateralInsurance, loans } from "../../../db/schema";

import {
    assertValidUuid,
    assertValidCreateInput,
    assertValidCollateralType,
    assertValidOtherSecurityType,
    assertValidCollateralStatus,
    assertValidInsuranceInput,
    assertNonNegativeAmount,
    assertValidDate,
} from "../validators/collateral.validators";

import { calculateLtv } from "../utils/ltv.util";
import { collateralLogger } from "../utils/logger";
import {
    CollateralNotFoundError,
    LoanNotFoundError,
    DuplicateCollateralError,
    LtvCalculationError,
    CollateralPersistenceError,
} from "../utils/errors";
import { DEFAULT_COLLATERAL_STATUS, SURVEY_NUMBER_TYPES } from "../constants/collateral.constants";

import type {
    CollateralType,
    CreateCollateralInput,
    UpdateCollateralInput,
    UpdateValuationInput,
    UpdateInsuranceInput,
    CollateralRecord,
    InsuranceRecord,
    LtvResult,
} from "../types/collateral.types";

type CollateralRow = typeof collaterals.$inferSelect;
type InsuranceRow = typeof collateralInsurance.$inferSelect;
type LoanRow = typeof loans.$inferSelect;

function toInsuranceRecord(row: InsuranceRow): InsuranceRecord {
    return {
        id: row.id,
        collateralId: row.collateralId,
        policyNumber: row.policyNumber,
        insurer: row.insurer,
        insuredAmount: row.insuredAmount,
        premiumAmount: row.premiumAmount,
        startDate: row.startDate,
        expiryDate: row.expiryDate,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function toCollateralRecord(row: CollateralRow, insurance: InsuranceRow | null): CollateralRecord {
    return {
        id: row.id,
        loanId: row.loanId,
        ownerId: row.ownerId,
        securityType: row.securityType,
        otherSecurityType: row.otherSecurityType,
        description: row.description,

        propertyType: row.propertyType,
        propertyAddress: row.propertyAddress,
        surveyNumber: row.surveyNumber,
        areaInSqFt: row.areaInSqFt,

        estimatedValue: row.estimatedValue,
        valuationDate: row.valuationDate,
        valuationBy: row.valuationBy,

        mortgageType: row.mortgageType,
        mortgageDate: row.mortgageDate,
        mortgageDeedNumber: row.mortgageDeedNumber,

        ltvRatio: row.ltvRatio,

        status: row.status,
        remarks: row.remarks,

        insurance: insurance ? toInsuranceRecord(insurance) : null,

        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/**
 * Generic collateral management service. Consuming modules (loans,
 * collections, ...) should only ever go through this class — never touch
 * the `collaterals` / `collateral_insurance` tables directly — so callers
 * stay decoupled from schema and validation details.
 *
 * This service intentionally contains no loan-approval or underwriting
 * logic; it only records and reports on security pledged against a loan.
 */
export class CollateralService {
    static async createCollateral(input: CreateCollateralInput): Promise<CollateralRecord> {
        assertValidCreateInput(input);

        const loan = await this.getActiveLoanRowOrThrow(input.loanId);

        if (input.surveyNumber && (SURVEY_NUMBER_TYPES as readonly string[]).includes(input.securityType)) {
            await this.assertNoDuplicate(input.loanId, input.securityType, input.surveyNumber);
        }

        const ltvRatio = this.tryCalculateLtv(loan.outstandingPrincipal ?? "0", input.estimatedValue);

        try {
            const [row] = await db
                .insert(collaterals)
                .values({
                    loanId: input.loanId,
                    ownerId: input.ownerId,
                    securityType: input.securityType,
                    otherSecurityType: input.otherSecurityType,
                    description: input.description,
                    propertyType: input.propertyType,
                    propertyAddress: input.propertyAddress,
                    surveyNumber: input.surveyNumber,
                    areaInSqFt: input.areaInSqFt !== undefined ? String(input.areaInSqFt) : undefined,
                    estimatedValue: String(input.estimatedValue),
                    valuationDate: input.valuationDate,
                    valuationBy: input.valuationBy,
                    mortgageType: input.mortgageType,
                    mortgageDate: input.mortgageDate,
                    mortgageDeedNumber: input.mortgageDeedNumber,
                    ltvRatio: ltvRatio !== null ? String(ltvRatio) : undefined,
                    status: input.status ?? DEFAULT_COLLATERAL_STATUS,
                    remarks: input.remarks,
                })
                .returning();

            collateralLogger.success("CREATE", row.id);
            return toCollateralRecord(row, null);
        } catch (error) {
            collateralLogger.failure("CREATE", input.loanId, error);
            throw new CollateralPersistenceError(
                `Failed to create collateral: ${error instanceof Error ? error.message : "Unknown error"}`,
                error
            );
        }
    }

    static async updateCollateral(id: string, input: UpdateCollateralInput): Promise<CollateralRecord> {
        assertValidUuid(id, "id");
        const existing = await this.getActiveCollateralRowOrThrow(id);

        if (input.securityType !== undefined) assertValidCollateralType(input.securityType);
        if (input.securityType !== undefined || input.otherSecurityType !== undefined) {
            assertValidOtherSecurityType(
                input.securityType ?? existing.securityType,
                input.otherSecurityType ?? existing.otherSecurityType ?? undefined,
            );
        }
        if (input.status !== undefined) assertValidCollateralStatus(input.status);
        if (input.estimatedValue !== undefined) assertNonNegativeAmount(input.estimatedValue, "estimatedValue");
        if (input.areaInSqFt !== undefined) assertNonNegativeAmount(input.areaInSqFt, "areaInSqFt");
        if (input.valuationDate !== undefined) assertValidDate(input.valuationDate, "valuationDate");
        if (input.mortgageDate !== undefined) assertValidDate(input.mortgageDate, "mortgageDate");
        if (input.ownerId !== undefined) assertValidUuid(input.ownerId, "ownerId");

        let ltvRatio: number | null | undefined;
        if (input.estimatedValue !== undefined) {
            const loan = await this.getActiveLoanRowOrThrow(existing.loanId);
            ltvRatio = this.tryCalculateLtv(loan.outstandingPrincipal ?? "0", input.estimatedValue);
        }

        try {
            const [row] = await db
                .update(collaterals)
                .set({
                    ownerId: input.ownerId,
                    securityType: input.securityType,
                    otherSecurityType: input.otherSecurityType,
                    description: input.description,
                    propertyType: input.propertyType,
                    propertyAddress: input.propertyAddress,
                    surveyNumber: input.surveyNumber,
                    areaInSqFt: input.areaInSqFt !== undefined ? String(input.areaInSqFt) : undefined,
                    estimatedValue: input.estimatedValue !== undefined ? String(input.estimatedValue) : undefined,
                    valuationDate: input.valuationDate,
                    valuationBy: input.valuationBy,
                    mortgageType: input.mortgageType,
                    mortgageDate: input.mortgageDate,
                    mortgageDeedNumber: input.mortgageDeedNumber,
                    ltvRatio: ltvRatio !== undefined && ltvRatio !== null ? String(ltvRatio) : undefined,
                    status: input.status,
                    remarks: input.remarks,
                    updatedAt: new Date(),
                })
                .where(eq(collaterals.id, id))
                .returning();

            collateralLogger.success("UPDATE", id);
            const insurance = await this.getActiveInsuranceForCollateral(id);
            return toCollateralRecord(row, insurance);
        } catch (error) {
            collateralLogger.failure("UPDATE", id, error);
            throw new CollateralPersistenceError(
                `Failed to update collateral: ${error instanceof Error ? error.message : "Unknown error"}`,
                error
            );
        }
    }

    static async deleteCollateral(id: string): Promise<void> {
        assertValidUuid(id, "id");
        await this.getActiveCollateralRowOrThrow(id);

        try {
            await db
                .update(collaterals)
                .set({ deletedAt: new Date(), status: "INACTIVE", updatedAt: new Date() })
                .where(eq(collaterals.id, id));

            collateralLogger.success("DELETE", id);
        } catch (error) {
            collateralLogger.failure("DELETE", id, error);
            throw new CollateralPersistenceError(
                `Failed to delete collateral: ${error instanceof Error ? error.message : "Unknown error"}`,
                error
            );
        }
    }

    static async getCollateral(id: string): Promise<CollateralRecord> {
        assertValidUuid(id, "id");
        const row = await this.getActiveCollateralRowOrThrow(id);
        const insurance = await this.getActiveInsuranceForCollateral(id);

        collateralLogger.success("GET", id);
        return toCollateralRecord(row, insurance);
    }

    static async getLoanCollaterals(loanId: string): Promise<CollateralRecord[]> {
        assertValidUuid(loanId, "loanId");
        await this.getActiveLoanRowOrThrow(loanId);

        const rows = await db
            .select()
            .from(collaterals)
            .where(and(eq(collaterals.loanId, loanId), isNull(collaterals.deletedAt)));

        if (rows.length === 0) {
            collateralLogger.success("LIST", loanId);
            return [];
        }

        const insuranceRows = await db
            .select()
            .from(collateralInsurance)
            .where(
                and(
                    inArray(
                        collateralInsurance.collateralId,
                        rows.map((row) => row.id)
                    ),
                    isNull(collateralInsurance.deletedAt)
                )
            );

        const latestInsuranceByCollateralId = new Map<string, InsuranceRow>();
        for (const insuranceRow of insuranceRows) {
            const current = latestInsuranceByCollateralId.get(insuranceRow.collateralId);
            if (!current || this.isNewer(insuranceRow, current)) {
                latestInsuranceByCollateralId.set(insuranceRow.collateralId, insuranceRow);
            }
        }

        collateralLogger.success("LIST", loanId);
        return rows.map((row) => toCollateralRecord(row, latestInsuranceByCollateralId.get(row.id) ?? null));
    }

    static async updateValuation(id: string, input: UpdateValuationInput): Promise<CollateralRecord> {
        assertValidUuid(id, "id");
        assertNonNegativeAmount(input.estimatedValue, "estimatedValue");
        if (input.valuationDate !== undefined) {
            assertValidDate(input.valuationDate, "valuationDate");
        }

        const existing = await this.getActiveCollateralRowOrThrow(id);
        const loan = await this.getActiveLoanRowOrThrow(existing.loanId);
        const ltvRatio = this.tryCalculateLtv(loan.outstandingPrincipal ?? "0", input.estimatedValue);

        try {
            const [row] = await db
                .update(collaterals)
                .set({
                    estimatedValue: String(input.estimatedValue),
                    valuationDate: input.valuationDate,
                    valuationBy: input.valuationBy,
                    ltvRatio: ltvRatio !== null ? String(ltvRatio) : undefined,
                    updatedAt: new Date(),
                })
                .where(eq(collaterals.id, id))
                .returning();

            collateralLogger.success("VALUATION_UPDATE", id);
            const insurance = await this.getActiveInsuranceForCollateral(id);
            return toCollateralRecord(row, insurance);
        } catch (error) {
            collateralLogger.failure("VALUATION_UPDATE", id, error);
            throw new CollateralPersistenceError(
                `Failed to update valuation: ${error instanceof Error ? error.message : "Unknown error"}`,
                error
            );
        }
    }

    static async updateInsurance(collateralId: string, input: UpdateInsuranceInput): Promise<InsuranceRecord> {
        assertValidUuid(collateralId, "id");
        assertValidInsuranceInput(input);

        await this.getActiveCollateralRowOrThrow(collateralId);
        const existingInsurance = await this.getActiveInsuranceForCollateral(collateralId);

        try {
            let row: InsuranceRow;

            if (existingInsurance) {
                [row] = await db
                    .update(collateralInsurance)
                    .set({
                        policyNumber: input.policyNumber,
                        insurer: input.insurer,
                        insuredAmount: input.insuredAmount !== undefined ? String(input.insuredAmount) : undefined,
                        premiumAmount: input.premiumAmount !== undefined ? String(input.premiumAmount) : undefined,
                        startDate: input.startDate,
                        expiryDate: input.expiryDate,
                        updatedAt: new Date(),
                    })
                    .where(eq(collateralInsurance.id, existingInsurance.id))
                    .returning();
            } else {
                [row] = await db
                    .insert(collateralInsurance)
                    .values({
                        collateralId,
                        policyNumber: input.policyNumber,
                        insurer: input.insurer,
                        insuredAmount: input.insuredAmount !== undefined ? String(input.insuredAmount) : undefined,
                        premiumAmount: input.premiumAmount !== undefined ? String(input.premiumAmount) : undefined,
                        startDate: input.startDate,
                        expiryDate: input.expiryDate,
                        status: DEFAULT_COLLATERAL_STATUS,
                    })
                    .returning();
            }

            collateralLogger.success("INSURANCE_UPDATE", collateralId);
            return toInsuranceRecord(row);
        } catch (error) {
            collateralLogger.failure("INSURANCE_UPDATE", collateralId, error);
            throw new CollateralPersistenceError(
                `Failed to update insurance details: ${error instanceof Error ? error.message : "Unknown error"}`,
                error
            );
        }
    }

    static async calculateLTV(collateralId: string): Promise<LtvResult> {
        assertValidUuid(collateralId, "id");
        const collateral = await this.getActiveCollateralRowOrThrow(collateralId);
        const loan = await this.getActiveLoanRowOrThrow(collateral.loanId);

        if (!collateral.estimatedValue) {
            throw new LtvCalculationError(
                `Collateral "${collateralId}" has no recorded valuation to calculate LTV against.`
            );
        }

        const outstanding = loan.outstandingPrincipal ?? "0";
        const ltvPercentage = calculateLtv(outstanding, collateral.estimatedValue);

        await db
            .update(collaterals)
            .set({ ltvRatio: String(ltvPercentage), updatedAt: new Date() })
            .where(eq(collaterals.id, collateralId));

        collateralLogger.success("LTV_CALCULATED", collateralId);

        return {
            collateralId,
            loanId: collateral.loanId,
            loanOutstanding: outstanding,
            marketValue: collateral.estimatedValue,
            ltvPercentage,
        };
    }

    private static isNewer(candidate: InsuranceRow, current: InsuranceRow): boolean {
        const candidateTime = candidate.createdAt?.getTime() ?? 0;
        const currentTime = current.createdAt?.getTime() ?? 0;
        return candidateTime > currentTime;
    }

    private static tryCalculateLtv(loanOutstanding: string, marketValue: number | string): number | null {
        try {
            return calculateLtv(loanOutstanding, marketValue);
        } catch {
            return null;
        }
    }

    private static async assertNoDuplicate(
        loanId: string,
        securityType: CollateralType,
        surveyNumber: string
    ): Promise<void> {
        const [existing] = await db
            .select()
            .from(collaterals)
            .where(
                and(
                    eq(collaterals.loanId, loanId),
                    eq(collaterals.securityType, securityType),
                    eq(collaterals.surveyNumber, surveyNumber),
                    isNull(collaterals.deletedAt)
                )
            )
            .limit(1);

        if (existing) {
            throw new DuplicateCollateralError(
                `A ${securityType} collateral with survey number "${surveyNumber}" already exists for loan "${loanId}".`
            );
        }
    }

    private static async getActiveCollateralRowOrThrow(id: string): Promise<CollateralRow> {
        const [row] = await db
            .select()
            .from(collaterals)
            .where(and(eq(collaterals.id, id), isNull(collaterals.deletedAt)))
            .limit(1);

        if (!row) {
            throw new CollateralNotFoundError(`No collateral found with id "${id}".`);
        }

        return row;
    }

    private static async getActiveLoanRowOrThrow(loanId: string): Promise<LoanRow> {
        const [row] = await db
            .select()
            .from(loans)
            .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)))
            .limit(1);

        if (!row) {
            throw new LoanNotFoundError(`No loan found with id "${loanId}".`);
        }

        return row;
    }

    private static async getActiveInsuranceForCollateral(collateralId: string): Promise<InsuranceRow | null> {
        const rows = await db
            .select()
            .from(collateralInsurance)
            .where(and(eq(collateralInsurance.collateralId, collateralId), isNull(collateralInsurance.deletedAt)));

        if (rows.length === 0) {
            return null;
        }

        return rows.reduce((latest, current) => (this.isNewer(current, latest) ? current : latest));
    }
}
