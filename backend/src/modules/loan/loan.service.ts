import type { z } from "zod";

import {
    BadRequestError,
    ConflictError,
    NotFoundError,
    ValidationError,
} from "../../common/errors/AppError";
import {
    buildPaginationMeta,
    type PaginatedResult,
} from "../../common/http/pagination";
import type { PaginationMeta } from "../../common/http/apiResponse";
import { db } from "../../db/index";
import * as loanRepository from "./loan.repository";
import { assertLoanInvariants, assertOtherSecurityType } from "./loan.validators";
import { EMPTY_METRICS, getOutstandingPrincipal, getOverdueMetrics } from "./loan.metrics";
import { getLoanIrrs } from "./loan.irr";
import { syncRepaymentSchedule } from "../repayment/repayment.service";
import {
    createInterestConfigRevision,
    createInterestRule,
    getCurrentInterestConfig,
    getInterestRulesForConfig,
} from "../interest/interest.repository";
import type {
    CreateLoanInput,
    ListLoansQuery,
    LoanWithBorrower,
    LoanWithMetrics,
    NewLoan,
    UpdateLoanInput,
} from "./loan.types";

/** Today's date as YYYY-MM-DD, matching the `date` columns' string format. */
const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * Loan business layer. Owns all rules and orchestration; delegates every DB
 * operation to the repository. Controllers must not talk to the repository
 * directly.
 */

const toMoney = (value: number | undefined): string | undefined =>
    value === undefined ? undefined : value.toFixed(2);

const num = (value: string | null): number | undefined =>
    value === null ? undefined : Number(value);

/* ────────────────────────────────────────────────────────
   INTEREST CONFIGURATION

   The loan is the source of the CURRENT interest configuration,
   but it does not store it: the values an operator edits here are
   persisted into the Interest module's own effective-dated
   interest_configs table, as a new revision. One store, so the
   Interest engine, the Repayment engine and the Ledger all read
   the same configuration the Loan module saved.

   A revision is never edited in place. Each one records what the
   period it governs was calculated under — the Ledger resolves a
   month's configuration by date — so rewriting one would silently
   change an already-calculated period. A change produces a new
   revision with its own effective-from date instead.

   No calculation happens here. The formulas, day-count logic and
   rounding all stay in the Interest module, which reads these
   values exactly as it always has.
──────────────────────────────────────────────────────── */

/** Applied only when neither the incoming save nor an existing revision says otherwise. */
const DEFAULT_INTEREST_BASIS = "ACTUAL_365";
const DEFAULT_CALCULATION_METHOD = "SIMPLE_INTEREST";

interface DesiredInterestConfig {
    annualRate: string;
    tdsRatePercent: string;
    interestBasis: string;
    calculationMethod: string;
    includeOpeningClosingDays: boolean;
    customFormula: string | null;
    effectiveFrom: string;
}

/**
 * The two combination rules the Interest module already enforces on a config
 * (see modules/interest/interest.validators.ts). Re-checked here because a
 * configuration can now also arrive through a loan save, and an invalid
 * combination must be rejected at the door rather than saved and thrown on
 * later at calculation time.
 */
const assertInterestConfigCoherent = (config: DesiredInterestConfig): void => {
    if (config.interestBasis === "CUSTOM" && !config.customFormula) {
        throw new BadRequestError(
            "customFormula is required when interestBasis is CUSTOM",
            { field: "customFormula" },
        );
    }

    if (
        config.calculationMethod === "RUNNING_BALANCE" &&
        (config.interestBasis === "FULL_MONTH" || config.interestBasis === "CUSTOM")
    ) {
        throw new BadRequestError(
            "Running Balance Method isn't supported for FULL_MONTH or CUSTOM interest basis",
            { field: "calculationMethod" },
        );
    }
};

/** The interest_configs revision currently in effect for a loan, or null when it has none. */
type CurrentInterestConfig = Awaited<ReturnType<typeof getCurrentInterestConfig>>;

/** Interest values the loan save carries, separate from the loan's own columns. */
type InterestConfigInput = {
    interestBasis?: string;
    calculationMethod?: string;
    includeOpeningClosingDays?: boolean;
    customFormula?: string | null;
    interestEffectiveFrom?: string;
};

/** Whether a save actually moves the configuration, numerically rather than textually ("20" vs "20.0000"). */
const interestConfigChanged = (
    desired: DesiredInterestConfig,
    current: NonNullable<Awaited<ReturnType<typeof getCurrentInterestConfig>>>,
): boolean =>
    Number(desired.annualRate) !== Number(current.annualRate) ||
    Number(desired.tdsRatePercent) !== Number(current.tdsRatePercent) ||
    desired.interestBasis !== current.interestBasis ||
    desired.calculationMethod !== current.calculationMethod ||
    desired.includeOpeningClosingDays !== (current.includeOpeningClosingDays ?? false) ||
    desired.customFormula !== (current.customFormula ?? null) ||
    desired.effectiveFrom !== current.effectiveFrom;

/**
 * Writes the loan's interest values as its current configuration — as a new
 * effective-dated revision, and only when they actually differ from the
 * revision already in effect, so an ordinary loan save doesn't pile up
 * identical revisions.
 *
 * Step-up/step-down/event rules are carried onto the new revision: they hang
 * off a config id, and changing a rate shouldn't quietly drop the slabs an
 * operator configured against the old one.
 */
const syncInterestConfig = async (
    loan: LoanWithBorrower,
    input: InterestConfigInput,
): Promise<void> => {
    const current = await getCurrentInterestConfig(loan.id);

    const desired: DesiredInterestConfig = {
        annualRate: loan.interestRate,
        tdsRatePercent: loan.tdsRatePercent,
        interestBasis:
            input.interestBasis ?? current?.interestBasis ?? DEFAULT_INTEREST_BASIS,
        calculationMethod:
            input.calculationMethod ??
            current?.calculationMethod ??
            DEFAULT_CALCULATION_METHOD,
        includeOpeningClosingDays:
            input.includeOpeningClosingDays ??
            current?.includeOpeningClosingDays ??
            false,
        // `null` here means "clear it", which `??` would misread as "not sent".
        customFormula:
            "customFormula" in input
                ? (input.customFormula ?? null)
                : (current?.customFormula ?? null),
        effectiveFrom:
            input.interestEffectiveFrom ??
            current?.effectiveFrom ??
            loan.firstDisbursementDate ??
            loan.sanctionDate ??
            today(),
    };

    if (current && !interestConfigChanged(desired, current)) return;

    assertInterestConfigCoherent(desired);

    const created = await createInterestConfigRevision({
        loanId: loan.id,
        annualRate: desired.annualRate,
        tdsRatePercent: desired.tdsRatePercent,
        interestBasis: desired.interestBasis,
        ruleType: current?.ruleType ?? undefined,
        effectiveFrom: desired.effectiveFrom,
        remarks: current ? "Revised from the Loan module" : "Created with the loan",
        customFormula: desired.customFormula ?? undefined,
        includeOpeningClosingDays: desired.includeOpeningClosingDays,
        calculationMethod: desired.calculationMethod,
    });

    if (!current || !created) return;

    for (const rule of await getInterestRulesForConfig(current.id)) {
        await createInterestRule({
            interestConfigId: created.id,
            fromMonth: rule.fromMonth ?? undefined,
            toMonth: rule.toMonth ?? undefined,
            rate: rule.rate,
            triggerEvent: rule.triggerEvent ?? undefined,
            remarks: rule.remarks ?? undefined,
        });
    }
};

/** Ensure the referenced borrower exists (required on create). */
const assertBorrowerExists = async (borrowerId: string): Promise<void> => {
    if (!(await loanRepository.borrowerExists(borrowerId))) {
        throw new BadRequestError(
            "borrowerId does not reference an existing borrower",
            { field: "borrowerId" },
        );
    }
};

/** Ensure the referenced relationship manager (user) exists, when provided. */
const assertRelationshipManagerExists = async (
    userId: string,
): Promise<void> => {
    if (!(await loanRepository.userExists(userId))) {
        throw new BadRequestError(
            "relationshipManagerId does not reference an existing user",
            { field: "relationshipManagerId" },
        );
    }
};

/** Ensure the loan account number is not already taken by another loan. */
const assertAccountNumberUnique = async (
    loanAccountNumber: string,
    excludeId?: string,
): Promise<void> => {
    if (
        await loanRepository.existsByLoanAccountNumber(
            loanAccountNumber,
            excludeId,
        )
    ) {
        throw new ConflictError(
            `A loan with account number '${loanAccountNumber}' already exists`,
            { field: "loanAccountNumber" },
        );
    }
};

export const createLoan = async (
    input: CreateLoanInput,
): Promise<LoanWithBorrower> => {
    await assertAccountNumberUnique(input.loanAccountNumber);
    await assertBorrowerExists(input.borrowerId);
    if (input.relationshipManagerId) {
        await assertRelationshipManagerExists(input.relationshipManagerId);
    }

    const values: NewLoan = {
        loanAccountNumber: input.loanAccountNumber,
        borrowerId: input.borrowerId,
        loanType: input.loanType,
        repaymentType: input.repaymentType,
        sanctionedAmount: toMoney(input.sanctionedAmount)!,
        interestRate: input.interestRate.toString(),
        tenureMonths: input.tenureMonths,
    };

    if (input.tdsRatePercent !== undefined)
        values.tdsRatePercent = input.tdsRatePercent.toString();
    if (input.securityType !== undefined) values.securityType = input.securityType;
    if (input.otherSecurityType !== undefined) values.otherSecurityType = input.otherSecurityType;
    if (input.disbursedAmount !== undefined)
        values.disbursedAmount = toMoney(input.disbursedAmount);
    if (input.outstandingPrincipal !== undefined)
        values.outstandingPrincipal = toMoney(input.outstandingPrincipal);
    if (input.moratoriumMonths !== undefined)
        values.moratoriumMonths = input.moratoriumMonths;
    if (input.sanctionDate !== undefined) values.sanctionDate = input.sanctionDate;
    if (input.firstDisbursementDate !== undefined)
        values.firstDisbursementDate = input.firstDisbursementDate;
    if (input.maturityDate !== undefined) values.maturityDate = input.maturityDate;
    if (input.purpose !== undefined) values.purpose = input.purpose;
    if (input.approvalNotes !== undefined)
        values.approvalNotes = input.approvalNotes;
    if (input.remarks !== undefined) values.remarks = input.remarks;
    if (input.status !== undefined) values.status = input.status;

    /* CIBIL reporting fields */
    if (input.creditType !== undefined) values.creditType = input.creditType;
    if (input.cibilAccountStatus !== undefined)
        values.cibilAccountStatus = input.cibilAccountStatus;
    if (input.assetClassification !== undefined)
        values.assetClassification = input.assetClassification;
    if (input.paymentFrequency !== undefined)
        values.paymentFrequency = input.paymentFrequency;
    if (input.emiAmount !== undefined) values.emiAmount = toMoney(input.emiAmount);
    if (input.collateralType !== undefined)
        values.collateralType = input.collateralType;
    if (input.collateralValue !== undefined)
        values.collateralValue = toMoney(input.collateralValue);

    if (input.relationshipManagerId !== undefined)
        values.relationshipManagerId = input.relationshipManagerId;
    if (input.createdBy !== undefined) values.createdBy = input.createdBy;

    // A loan created with an initial disbursed amount gets tranche #1 recorded
    // in the same transaction, so accounting-export's disbursement report (and
    // any other reader of loan_tranches) sees it immediately and consistently.
    const loan =
        input.disbursedAmount !== undefined && input.disbursedAmount > 0
            ? await db.transaction(async (tx) => {
                  const created = await loanRepository.create(values, tx);
                  await loanRepository.createTranche(
                      {
                          loanId: created.id,
                          trancheNumber: 1,
                          amount: toMoney(input.disbursedAmount)!,
                          disbursementDate: input.firstDisbursementDate ?? today(),
                          remarks: "Initial disbursement",
                      },
                      tx,
                  );
                  return created;
              })
            : await loanRepository.create(values);

    // The loan's interest values become its interest configuration straight
    // away, so the Interest engine, the Repayment engine and the Ledger all
    // have something to read from the moment the loan exists.
    await syncInterestConfig(loan, input);
    await syncRepaymentSchedule(loan.id);

    return loan;
};

/**
 * Attach derived overdue/DPD/classification/next-due-date fields to each
 * loan, and overwrite `outstandingPrincipal` with the computed value (see
 * `loan.metrics.ts` — the stored column isn't kept in sync with payments).
 */
const enrichWithMetrics = async (
    loans: LoanWithBorrower[],
): Promise<LoanWithMetrics[]> => {
    const loanIds = loans.map((l) => l.id);
    const [metrics, outstanding] = await Promise.all([
        getOverdueMetrics(loanIds),
        getOutstandingPrincipal(loanIds),
    ]);
    return loans.map((loan) => ({
        ...loan,
        ...(metrics.get(loan.id) ?? EMPTY_METRICS),
        outstandingPrincipal: (outstanding.get(loan.id) ?? 0).toFixed(2),
    }));
};

export const getLoanById = async (
    id: string,
): Promise<LoanWithMetrics & { irr: number | null; interestConfig: CurrentInterestConfig }> => {
    const loan = await loanRepository.findById(id);
    if (!loan) throw new NotFoundError(`Loan '${id}' not found`);
    const [enriched] = await enrichWithMetrics([loan]);
    const irrs = await getLoanIrrs([id]);
    // The configuration in effect, so reopening the loan shows what was saved
    // rather than falling back to defaults. Null only for a loan that predates
    // having one at all.
    const interestConfig = await getCurrentInterestConfig(id);
    return { ...enriched!, irr: irrs.get(id) ?? null, interestConfig };
};

export const listLoans = async (
    query: ListLoansQuery,
): Promise<{ data: LoanWithMetrics[]; meta: PaginationMeta }> => {
    const { rows, total }: PaginatedResult<LoanWithBorrower> =
        await loanRepository.findAll(query);
    return {
        data: await enrichWithMetrics(rows),
        meta: buildPaginationMeta(query.page, query.limit, total),
    };
};

/**
 * Re-validates cross-field money/date invariants against the merged view of the
 * loan (persisted values overlaid with the incoming patch).
 */
const assertMergedInvariants = (
    existing: LoanWithBorrower,
    input: UpdateLoanInput,
): void => {
    const merged = {
        sanctionedAmount:
            input.sanctionedAmount ?? num(existing.sanctionedAmount),
        disbursedAmount: input.disbursedAmount ?? num(existing.disbursedAmount),
        outstandingPrincipal:
            input.outstandingPrincipal ?? num(existing.outstandingPrincipal),
        sanctionDate:
            "sanctionDate" in input ? input.sanctionDate : existing.sanctionDate,
        firstDisbursementDate:
            "firstDisbursementDate" in input
                ? input.firstDisbursementDate
                : existing.firstDisbursementDate,
        maturityDate:
            "maturityDate" in input ? input.maturityDate : existing.maturityDate,
        securityType: input.securityType ?? existing.securityType,
        otherSecurityType:
            "otherSecurityType" in input
                ? input.otherSecurityType
                : existing.otherSecurityType,
    };

    const issues: { path: PropertyKey[]; message: string }[] = [];
    const collectingCtx = {
        addIssue: (issue: { path?: PropertyKey[]; message?: string }) =>
            issues.push({
                path: issue.path ?? [],
                message: issue.message ?? "Invalid value",
            }),
        path: [] as PropertyKey[],
    } as unknown as z.RefinementCtx;
    assertLoanInvariants(merged, collectingCtx);
    assertOtherSecurityType(merged, collectingCtx);

    if (issues.length > 0) {
        throw new ValidationError("Validation failed", {
            fieldErrors: issues.reduce<Record<string, string[]>>((acc, issue) => {
                const key = String(issue.path[0] ?? "_");
                (acc[key] ??= []).push(issue.message);
                return acc;
            }, {}),
        });
    }
};

export const updateLoan = async (
    id: string,
    input: UpdateLoanInput,
): Promise<LoanWithBorrower> => {
    const existing = await loanRepository.findById(id);
    if (!existing) throw new NotFoundError(`Loan '${id}' not found`);

    if (
        input.loanAccountNumber !== undefined &&
        input.loanAccountNumber !== existing.loanAccountNumber
    ) {
        await assertAccountNumberUnique(input.loanAccountNumber, id);
    }
    if (input.borrowerId !== undefined) {
        await assertBorrowerExists(input.borrowerId);
    }
    if (input.relationshipManagerId) {
        await assertRelationshipManagerExists(input.relationshipManagerId);
    }

    assertMergedInvariants(existing, input);

    const patch: Partial<NewLoan> = {};
    if (input.loanAccountNumber !== undefined)
        patch.loanAccountNumber = input.loanAccountNumber;
    if (input.borrowerId !== undefined) patch.borrowerId = input.borrowerId;
    if (input.loanType !== undefined) patch.loanType = input.loanType;
    if (input.securityType !== undefined) patch.securityType = input.securityType;
    if ("otherSecurityType" in input)
        patch.otherSecurityType = input.otherSecurityType ?? null;
    if (input.repaymentType !== undefined)
        patch.repaymentType = input.repaymentType;
    if (input.sanctionedAmount !== undefined)
        patch.sanctionedAmount = toMoney(input.sanctionedAmount);
    if (input.disbursedAmount !== undefined)
        patch.disbursedAmount = toMoney(input.disbursedAmount);
    if (input.outstandingPrincipal !== undefined)
        patch.outstandingPrincipal = toMoney(input.outstandingPrincipal);
    if (input.interestRate !== undefined)
        patch.interestRate = input.interestRate.toString();
    if (input.tdsRatePercent !== undefined)
        patch.tdsRatePercent = input.tdsRatePercent.toString();
    if (input.tenureMonths !== undefined) patch.tenureMonths = input.tenureMonths;
    if (input.moratoriumMonths !== undefined)
        patch.moratoriumMonths = input.moratoriumMonths;
    if ("sanctionDate" in input) patch.sanctionDate = input.sanctionDate ?? null;
    if ("firstDisbursementDate" in input)
        patch.firstDisbursementDate = input.firstDisbursementDate ?? null;
    if ("maturityDate" in input) patch.maturityDate = input.maturityDate ?? null;
    if ("purpose" in input) patch.purpose = input.purpose ?? null;
    if ("approvalNotes" in input) patch.approvalNotes = input.approvalNotes ?? null;
    if ("remarks" in input) patch.remarks = input.remarks ?? null;
    if (input.status !== undefined) patch.status = input.status;

    /* CIBIL reporting fields */
    if ("creditType" in input) patch.creditType = input.creditType ?? null;
    if ("cibilAccountStatus" in input)
        patch.cibilAccountStatus = input.cibilAccountStatus ?? null;
    if ("assetClassification" in input)
        patch.assetClassification = input.assetClassification ?? null;
    if ("paymentFrequency" in input)
        patch.paymentFrequency = input.paymentFrequency ?? null;
    if ("emiAmount" in input)
        patch.emiAmount =
            input.emiAmount !== null && input.emiAmount !== undefined
                ? toMoney(input.emiAmount)
                : null;
    if ("collateralType" in input)
        patch.collateralType = input.collateralType ?? null;
    if ("collateralValue" in input)
        patch.collateralValue =
            input.collateralValue !== null && input.collateralValue !== undefined
                ? toMoney(input.collateralValue)
                : null;

    if ("relationshipManagerId" in input)
        patch.relationshipManagerId = input.relationshipManagerId ?? null;

    // An increase in disbursedAmount is a new tranche being drawn down; record
    // it atomically with the loan update. A decrease (correction) or an
    // unchanged amount records no tranche — see accounting-export's decision
    // not to model negative disbursements.
    const previousDisbursed = num(existing.disbursedAmount) ?? 0;
    const disbursementIncrease =
        input.disbursedAmount !== undefined
            ? input.disbursedAmount - previousDisbursed
            : 0;

    let updated: LoanWithBorrower;

    if (disbursementIncrease > 0) {
        updated = await db.transaction(async (tx) => {
            const result = await loanRepository.update(id, patch, tx);
            if (!result) throw new NotFoundError(`Loan '${id}' not found`);

            const trancheNumber = (await loanRepository.countTranches(id, tx)) + 1;
            await loanRepository.createTranche(
                {
                    loanId: id,
                    trancheNumber,
                    amount: toMoney(disbursementIncrease)!,
                    disbursementDate: today(),
                    remarks: `Additional disbursement (tranche ${trancheNumber})`,
                },
                tx,
            );

            return result;
        });
    } else {
        const result = await loanRepository.update(id, patch);
        if (!result) throw new NotFoundError(`Loan '${id}' not found`);
        updated = result;
    }

    // The saved interest values become this loan's current configuration.
    // Ordered before the schedule re-sync below, which reads that
    // configuration to regenerate from.
    await syncInterestConfig(updated, input);

    // Keep the repayment schedule in sync with whatever just changed —
    // regenerates automatically if nothing's been paid yet, otherwise leaves
    // it alone and lets the frontend flag it as stale. Never blocks the
    // loan update itself if this fails for any reason.
    await syncRepaymentSchedule(id);

    return updated;
};

export const deleteLoan = async (id: string): Promise<void> => {
    const deleted = await loanRepository.softDelete(id);
    if (!deleted) throw new NotFoundError(`Loan '${id}' not found`);
};
