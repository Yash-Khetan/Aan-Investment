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
    if (input.disbursedAmount !== undefined && input.disbursedAmount > 0) {
        return db.transaction(async (tx) => {
            const loan = await loanRepository.create(values, tx);
            await loanRepository.createTranche(
                {
                    loanId: loan.id,
                    trancheNumber: 1,
                    amount: toMoney(input.disbursedAmount)!,
                    disbursementDate: input.firstDisbursementDate ?? today(),
                    remarks: "Initial disbursement",
                },
                tx,
            );
            return loan;
        });
    }

    return loanRepository.create(values);
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
): Promise<LoanWithMetrics & { irr: number | null }> => {
    const loan = await loanRepository.findById(id);
    if (!loan) throw new NotFoundError(`Loan '${id}' not found`);
    const [enriched] = await enrichWithMetrics([loan]);
    const irrs = await getLoanIrrs([id]);
    return { ...enriched!, irr: irrs.get(id) ?? null };
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
