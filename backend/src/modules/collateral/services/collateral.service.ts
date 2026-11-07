import { and, eq, isNull, inArray } from "drizzle-orm";
import { db } from "../../../db";
import { collaterals, collateralInsurance, loans } from "../../../db/schema";
import type { RequestActor } from "../../../common/http/actor";
import { AUDIT_ENTITY } from "../../audit/audit.constants";
import { recordAudit } from "../../audit/audit.service";
import { registerApplier, submitChangeRequest } from "../../change-request/change-request.service";
import { CHANGE_REQUEST_ENTITY } from "../../change-request/change-request.constants";

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
import { getLoanSnapshot } from "../../ledger/snapshot.service";
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

/**
 * LTV as of now: the loan's ledger principal over this collateral's value.
 * Never stored — computed on every read. Null when there is no valuation to
 * divide by.
 */
function liveLtv(row: CollateralRow, loanOutstanding: number): string | null {
    if (!row.estimatedValue) return null;
    try {
        return String(calculateLtv(loanOutstanding, row.estimatedValue));
    } catch {
        return null;
    }
}

function toCollateralRecord(
    row: CollateralRow,
    insurance: InsuranceRow | null,
    loanOutstanding: number,
): CollateralRecord {
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

        ltvRatio: liveLtv(row, loanOutstanding),

        status: row.status,
        remarks: row.remarks,

        insurance: insurance ? toInsuranceRecord(insurance) : null,

        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/** The loan's principal outstanding per its ledger — what every LTV is measured against. Never negative. */
async function loanOutstanding(loanId: string): Promise<number> {
    const snapshot = await getLoanSnapshot(loanId);
    return Math.max(snapshot.principalOutstanding, 0);
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
                    status: input.status ?? DEFAULT_COLLATERAL_STATUS,
                    remarks: input.remarks,
                })
                .returning();
            if (!row) throw new Error("The database returned no row for this write.");

            collateralLogger.success("CREATE", row.id);
            return toCollateralRecord(row, null, await loanOutstanding(row.loanId));
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
                    status: input.status,
                    remarks: input.remarks,
                    updatedAt: new Date(),
                })
                .where(eq(collaterals.id, id))
                .returning();
            if (!row) throw new Error("The database returned no row for this write.");

            collateralLogger.success("UPDATE", id);
            const insurance = await this.getActiveInsuranceForCollateral(id);
            return toCollateralRecord(row, insurance, await loanOutstanding(row.loanId));
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
        return toCollateralRecord(row, insurance, await loanOutstanding(row.loanId));
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
        const outstanding = await loanOutstanding(loanId);
        return rows.map((row) =>
            toCollateralRecord(row, latestInsuranceByCollateralId.get(row.id) ?? null, outstanding),
        );
    }

    static async updateValuation(id: string, input: UpdateValuationInput): Promise<CollateralRecord> {
        assertValidUuid(id, "id");
        assertNonNegativeAmount(input.estimatedValue, "estimatedValue");
        if (input.valuationDate !== undefined) {
            assertValidDate(input.valuationDate, "valuationDate");
        }

        const existing = await this.getActiveCollateralRowOrThrow(id);
        const loan = await this.getActiveLoanRowOrThrow(existing.loanId);
        try {
            const [row] = await db
                .update(collaterals)
                .set({
                    estimatedValue: String(input.estimatedValue),
                    valuationDate: input.valuationDate,
                    valuationBy: input.valuationBy,
                    updatedAt: new Date(),
                })
                .where(eq(collaterals.id, id))
                .returning();
            if (!row) throw new Error("The database returned no row for this write.");

            collateralLogger.success("VALUATION_UPDATE", id);
            const insurance = await this.getActiveInsuranceForCollateral(id);
            return toCollateralRecord(row, insurance, await loanOutstanding(row.loanId));
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
            let row: InsuranceRow | undefined;

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

            if (!row) throw new Error("The database returned no row for this write.");

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

    /* ────────────────────────────────────────────────────────
       APPROVAL GATE

       Editing a collateral's valuation or insurance moves the
       figures a loan's LTV and risk exposure are read off. An
       employee's request on those fields is held as a PENDING
       change request instead of applying; an admin's request, or
       anything outside this list, applies immediately as before.
    ──────────────────────────────────────────────────────── */

    private static readonly FINANCIAL_COLLATERAL_FIELDS = [
        "estimatedValue",
        "valuationDate",
        "valuationBy",
    ] as const satisfies readonly (keyof UpdateCollateralInput)[];

    private static splitCollateralInput(
        input: UpdateCollateralInput,
    ): { financial: Partial<UpdateCollateralInput>; nonFinancial: Partial<UpdateCollateralInput> } {
        const financial: Partial<UpdateCollateralInput> = {};
        const nonFinancial: Partial<UpdateCollateralInput> = {};

        for (const key of Object.keys(input) as (keyof UpdateCollateralInput)[]) {
            if ((CollateralService.FINANCIAL_COLLATERAL_FIELDS as readonly string[]).includes(key)) {
                (financial as Record<string, unknown>)[key] = input[key];
            } else {
                (nonFinancial as Record<string, unknown>)[key] = input[key];
            }
        }

        return { financial, nonFinancial };
    }

    private static pickExisting(existing: CollateralRow, keys: readonly string[]): Record<string, unknown> {
        const picked: Record<string, unknown> = {};
        for (const key of keys) picked[key] = (existing as Record<string, unknown>)[key];
        return picked;
    }

    static async requestUpdateCollateral(
        id: string,
        input: UpdateCollateralInput,
        actor: RequestActor,
    ): Promise<{ collateral: CollateralRecord; pendingChangeRequest: Awaited<ReturnType<typeof submitChangeRequest>> | null }> {
        const existing = await this.getActiveCollateralRowOrThrow(id);

        if (actor.isAdmin) {
            const collateral = await this.updateCollateral(id, input);
            await recordAudit({
                actor: { userId: actor.userId, ipAddress: actor.ipAddress, userAgent: actor.userAgent },
                action: "UPDATE",
                entityType: AUDIT_ENTITY.COLLATERAL,
                entityId: id,
                oldValues: this.pickExisting(existing, Object.keys(input)),
                newValues: input,
            });
            return { collateral, pendingChangeRequest: null };
        }

        const { financial, nonFinancial } = this.splitCollateralInput(input);

        let collateral = await this.getCollateral(id);
        if (Object.keys(nonFinancial).length > 0) {
            collateral = await this.updateCollateral(id, nonFinancial);
            await recordAudit({
                actor: { userId: actor.userId, ipAddress: actor.ipAddress, userAgent: actor.userAgent },
                action: "UPDATE",
                entityType: AUDIT_ENTITY.COLLATERAL,
                entityId: id,
                oldValues: this.pickExisting(existing, Object.keys(nonFinancial)),
                newValues: nonFinancial,
            });
        }

        let pendingChangeRequest: Awaited<ReturnType<typeof submitChangeRequest>> | null = null;
        if (Object.keys(financial).length > 0) {
            pendingChangeRequest = await submitChangeRequest({
                entityType: CHANGE_REQUEST_ENTITY.COLLATERAL,
                entityId: id,
                action: "UPDATE",
                payload: financial,
                previousValues: this.pickExisting(existing, Object.keys(financial)),
                loanId: existing.loanId,
                requestedBy: actor.userId,
            });
        }

        return { collateral, pendingChangeRequest };
    }

    static async requestDeleteCollateral(
        id: string,
        actor: RequestActor,
    ): Promise<{ deleted: boolean; pendingChangeRequest: Awaited<ReturnType<typeof submitChangeRequest>> | null }> {
        const existing = await this.getActiveCollateralRowOrThrow(id);

        if (actor.isAdmin) {
            await this.deleteCollateral(id);
            await recordAudit({
                actor: { userId: actor.userId, ipAddress: actor.ipAddress, userAgent: actor.userAgent },
                action: "DELETE",
                entityType: AUDIT_ENTITY.COLLATERAL,
                entityId: id,
                oldValues: existing,
            });
            return { deleted: true, pendingChangeRequest: null };
        }

        const pendingChangeRequest = await submitChangeRequest({
            entityType: CHANGE_REQUEST_ENTITY.COLLATERAL,
            entityId: id,
            action: "DELETE",
            payload: null,
            previousValues: existing,
            loanId: existing.loanId,
            requestedBy: actor.userId,
        });

        return { deleted: false, pendingChangeRequest };
    }

    /** `updateValuation` is wholly financial (a single-purpose endpoint already) — no split needed. */
    static async requestUpdateValuation(
        id: string,
        input: UpdateValuationInput,
        actor: RequestActor,
    ): Promise<{ collateral: CollateralRecord; pendingChangeRequest: Awaited<ReturnType<typeof submitChangeRequest>> | null }> {
        const existing = await this.getActiveCollateralRowOrThrow(id);

        if (actor.isAdmin) {
            const collateral = await this.updateValuation(id, input);
            await recordAudit({
                actor: { userId: actor.userId, ipAddress: actor.ipAddress, userAgent: actor.userAgent },
                action: "UPDATE",
                entityType: AUDIT_ENTITY.COLLATERAL,
                entityId: id,
                oldValues: this.pickExisting(existing, ["estimatedValue", "valuationDate", "valuationBy"]),
                newValues: input,
            });
            return { collateral, pendingChangeRequest: null };
        }

        const pendingChangeRequest = await submitChangeRequest({
            entityType: CHANGE_REQUEST_ENTITY.COLLATERAL,
            entityId: id,
            action: "UPDATE",
            payload: input,
            previousValues: this.pickExisting(existing, ["estimatedValue", "valuationDate", "valuationBy"]),
            loanId: existing.loanId,
            requestedBy: actor.userId,
        });

        return { collateral: await this.getCollateral(id), pendingChangeRequest };
    }

    /** `updateInsurance` writes a different table than `updateCollateral` — its own entity type. */
    static async requestUpdateInsurance(
        collateralId: string,
        input: UpdateInsuranceInput,
        actor: RequestActor,
    ): Promise<{ insurance: InsuranceRecord | null; pendingChangeRequest: Awaited<ReturnType<typeof submitChangeRequest>> | null }> {
        const existingCollateral = await this.getActiveCollateralRowOrThrow(collateralId);
        const existingInsurance = await this.getActiveInsuranceForCollateral(collateralId);

        if (actor.isAdmin) {
            const insurance = await this.updateInsurance(collateralId, input);
            await recordAudit({
                actor: { userId: actor.userId, ipAddress: actor.ipAddress, userAgent: actor.userAgent },
                action: "UPDATE",
                entityType: AUDIT_ENTITY.COLLATERAL_INSURANCE,
                entityId: collateralId,
                oldValues: existingInsurance ? toInsuranceRecord(existingInsurance) : null,
                newValues: input,
            });
            return { insurance, pendingChangeRequest: null };
        }

        const pendingChangeRequest = await submitChangeRequest({
            entityType: CHANGE_REQUEST_ENTITY.COLLATERAL_INSURANCE,
            entityId: collateralId,
            action: "UPDATE",
            payload: input,
            previousValues: existingInsurance ? toInsuranceRecord(existingInsurance) : null,
            loanId: existingCollateral.loanId,
            requestedBy: actor.userId,
        });

        return {
            insurance: existingInsurance ? toInsuranceRecord(existingInsurance) : null,
            pendingChangeRequest,
        };
    }

    /** The collateral's LTV as of now. Read-only: LTV is never stored. */
    static async calculateLTV(collateralId: string): Promise<LtvResult> {
        assertValidUuid(collateralId, "id");
        const collateral = await this.getActiveCollateralRowOrThrow(collateralId);
        const loan = await this.getActiveLoanRowOrThrow(collateral.loanId);

        if (!collateral.estimatedValue) {
            throw new LtvCalculationError(
                `Collateral "${collateralId}" has no recorded valuation to calculate LTV against.`
            );
        }

        const outstanding = String(await loanOutstanding(loan.id));
        const ltvPercentage = calculateLtv(outstanding, collateral.estimatedValue);

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

// Approving a pending COLLATERAL/COLLATERAL_INSURANCE change calls the exact
// same functions an admin's own direct edit would — registered once, at
// module load, so the generic change-request module never has to import
// this one.
registerApplier(CHANGE_REQUEST_ENTITY.COLLATERAL, "UPDATE", (payload, entityId) =>
    CollateralService.updateCollateral(entityId!, payload as UpdateCollateralInput),
);
registerApplier(CHANGE_REQUEST_ENTITY.COLLATERAL, "DELETE", async (_payload, entityId) => {
    await CollateralService.deleteCollateral(entityId!);
    return { id: entityId! };
});
registerApplier(CHANGE_REQUEST_ENTITY.COLLATERAL_INSURANCE, "UPDATE", (payload, entityId) =>
    CollateralService.updateInsurance(entityId!, payload as UpdateInsuranceInput),
);
