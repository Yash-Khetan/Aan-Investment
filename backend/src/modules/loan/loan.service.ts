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
import { getLoanIrrs } from "./loan.irr";
import { getLoanSnapshots } from "../ledger/snapshot.service";
import {
    createInterestConfigRevision,
    getCurrentInterestConfig,
} from "../interest/interest.repository";
import type { InterestBasis } from "../interest/interest.types";
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

/* ────────────────────────────────────────────────────────
   INTEREST CONFIGURATION

   The loan form is where an operator edits the interest rate, TDS
   rate and day-count basis, but the loan row does not store them:
   they are persisted only into the effective-dated interest_configs
   table, as a new revision. One store, so the ledger accrues at
   exactly what the loan form saved.

   A revision is never edited in place. Each one records what the
   period it governs was calculated under — the ledger resolves a
   month's configuration by date — so rewriting one would silently
   change an already-calculated period. A change produces a new
   revision with its own effective-from date instead.
──────────────────────────────────────────────────────── */

/** Applied only when neither the incoming save nor an existing revision says otherwise. */
const DEFAULT_INTEREST_BASIS: InterestBasis = "ACTUAL_365";
const DEFAULT_TDS_RATE_PERCENT = "10";

/** The Drizzle transaction handle handed to `db.transaction()`'s callback. */
type Transaction = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

interface DesiredInterestConfig {
    annualRate: string;
    tdsRatePercent: string;
    interestBasis: InterestBasis;
    includeOpeningClosingDays: boolean;
    effectiveFrom: string;
}

/** The interest_configs revision currently in effect for a loan, or null when it has none. */
type CurrentInterestConfig = Awaited<ReturnType<typeof getCurrentInterestConfig>>;

/** Interest values a loan save carries. */
type InterestConfigInput = {
    interestRate?: number;
    tdsRatePercent?: number;
    interestBasis?: InterestBasis;
    includeOpeningClosingDays?: boolean;
    interestEffectiveFrom?: string;
};

/** Whether a save actually moves the configuration, numerically rather than textually ("20" vs "20.0000"). */
const interestConfigChanged = (
    desired: DesiredInterestConfig,
    current: NonNullable<CurrentInterestConfig>,
): boolean =>
    Number(desired.annualRate) !== Number(current.annualRate) ||
    Number(desired.tdsRatePercent) !== Number(current.tdsRatePercent) ||
    desired.interestBasis !== current.interestBasis ||
    desired.includeOpeningClosingDays !== current.includeOpeningClosingDays ||
    desired.effectiveFrom !== current.effectiveFrom;

/**
 * Writes the loan's interest values as its current configuration — as a new
 * effective-dated revision, and only when they actually differ from the
 * revision already in effect, so an ordinary loan save doesn't pile up
 * identical revisions. Runs inside the caller's transaction, so the loan and
 * its configuration are saved together or not at all.
 */
const syncInterestConfig = async (
    loanId: string,
    current: CurrentInterestConfig,
    input: InterestConfigInput,
    defaultEffectiveFrom: string,
    tx: Transaction,
): Promise<void> => {
    const annualRate = input.interestRate?.toString() ?? current?.annualRate;
    if (annualRate === undefined) {
        throw new BadRequestError("interestRate is required", { field: "interestRate" });
    }

    const desired: DesiredInterestConfig = {
        annualRate,
        tdsRatePercent:
            input.tdsRatePercent?.toString() ?? current?.tdsRatePercent ?? DEFAULT_TDS_RATE_PERCENT,
        interestBasis: input.interestBasis ?? current?.interestBasis ?? DEFAULT_INTEREST_BASIS,
        includeOpeningClosingDays:
            input.includeOpeningClosingDays ?? current?.includeOpeningClosingDays ?? false,
        effectiveFrom: input.interestEffectiveFrom ?? current?.effectiveFrom ?? defaultEffectiveFrom,
    };

    if (current && !interestConfigChanged(desired, current)) return;

    await createInterestConfigRevision(
        {
            loanId,
            ...desired,
            remarks: current ? "Revised from the Loan module" : "Created with the loan",
        },
        tx,
    );
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
        tenureMonths: input.tenureMonths,
    };

    if (input.securityType !== undefined) values.securityType = input.securityType;
    if (input.otherSecurityType !== undefined) values.otherSecurityType = input.otherSecurityType;
    if (input.moratoriumMonths !== undefined)
        values.moratoriumMonths = input.moratoriumMonths;
    if (input.sanctionDate !== undefined) values.sanctionDate = input.sanctionDate;
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

    // The loan and its first interest configuration commit together, so no
    // loan ever exists without the rates its ledger accrues at. Money enters
    // the loan only afterwards, as Payment entries on its ledger.
    const id = await db.transaction(async (tx) => {
        const loanId = await loanRepository.create(values, tx);
        await syncInterestConfig(loanId, null, input, input.sanctionDate ?? today(), tx);
        return loanId;
    });

    return (await loanRepository.findById(id))!;
};

/**
 * Attach each loan's money figures, all read off its ledger through the one
 * loan snapshot (ledger/snapshot.ts): amount overdue, DPD, classification,
 * next due date, the balance bifurcation, and the full snapshot.
 */
const enrichWithMetrics = async (
    loans: LoanWithBorrower[],
): Promise<LoanWithMetrics[]> => {
    const snapshots = await getLoanSnapshots(loans.map((l) => l.id));
    return loans.map((loan) => {
        const snapshot = snapshots.get(loan.id)!;
        return {
            ...loan,
            amountOverdue: snapshot.amountOverdue,
            dpd: snapshot.dpd,
            classification: snapshot.classification,
            nextDueDate: snapshot.nextDueDate,
            balanceBifurcation: snapshot.hasEntries ? snapshot.bifurcation : null,
            snapshot,
        };
    });
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
        sanctionDate:
            "sanctionDate" in input ? input.sanctionDate : existing.sanctionDate,
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
    if (input.tenureMonths !== undefined) patch.tenureMonths = input.tenureMonths;
    if (input.moratoriumMonths !== undefined)
        patch.moratoriumMonths = input.moratoriumMonths;
    if ("sanctionDate" in input) patch.sanctionDate = input.sanctionDate ?? null;
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

    // The loan's own fields and its interest configuration commit together.
    const currentConfig = await getCurrentInterestConfig(id);
    await db.transaction(async (tx) => {
        const found = await loanRepository.update(id, patch, tx);
        if (!found) throw new NotFoundError(`Loan '${id}' not found`);
        await syncInterestConfig(
            id,
            currentConfig,
            input,
            input.sanctionDate ?? existing.sanctionDate ?? today(),
            tx,
        );
    });

    return (await loanRepository.findById(id))!;
};

export const deleteLoan = async (id: string): Promise<void> => {
    const deleted = await loanRepository.softDelete(id);
    if (!deleted) throw new NotFoundError(`Loan '${id}' not found`);
};
