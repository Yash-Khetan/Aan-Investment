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
import * as loanRepository from "./loan.repository";
import { assertLoanInvariants } from "./loan.validators";
import type {
    CreateLoanInput,
    ListLoansQuery,
    LoanWithBorrower,
    NewLoan,
    UpdateLoanInput,
} from "./loan.types";

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
    if (input.relationshipManagerId !== undefined)
        values.relationshipManagerId = input.relationshipManagerId;
    if (input.createdBy !== undefined) values.createdBy = input.createdBy;

    return loanRepository.create(values);
};

export const getLoanById = async (id: string): Promise<LoanWithBorrower> => {
    const loan = await loanRepository.findById(id);
    if (!loan) throw new NotFoundError(`Loan '${id}' not found`);
    return loan;
};

export const listLoans = async (
    query: ListLoansQuery,
): Promise<{ data: LoanWithBorrower[]; meta: PaginationMeta }> => {
    const { rows, total }: PaginatedResult<LoanWithBorrower> =
        await loanRepository.findAll(query);
    return {
        data: rows,
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
    if ("relationshipManagerId" in input)
        patch.relationshipManagerId = input.relationshipManagerId ?? null;

    const updated = await loanRepository.update(id, patch);
    if (!updated) throw new NotFoundError(`Loan '${id}' not found`);
    return updated;
};

export const deleteLoan = async (id: string): Promise<void> => {
    const deleted = await loanRepository.softDelete(id);
    if (!deleted) throw new NotFoundError(`Loan '${id}' not found`);
};
