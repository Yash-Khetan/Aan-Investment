import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "../../db/index";
import { loans, loanTranches } from "../../db/schema";
import type { Loan, LoanTranche, NewLoanTranche } from "./disbursement.types";

/**
 * Disbursement (loan tranche) data-access layer. Database concerns only — no
 * business rules. Tranches are never soft-deleted (no `deletedAt` column).
 */

/** The Drizzle transaction handle handed to `db.transaction()`'s callback. */
type Transaction = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/** The database executor: the singleton `db`, or a transaction handle. */
type Executor = typeof db | Transaction;

/** True if a non-deleted loan exists with this id. */
export const loanExists = async (loanId: string): Promise<boolean> => {
    const [row] = await db
        .select({ id: loans.id })
        .from(loans)
        .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)))
        .limit(1);

    return Boolean(row);
};

/** Fetch a single non-deleted loan, needed to derive the new disbursed total. */
export const findLoanById = async (loanId: string): Promise<Loan | undefined> => {
    const [row] = await db
        .select()
        .from(loans)
        .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)))
        .limit(1);

    return row;
};

/** All tranches for a loan, oldest first. */
export const listByLoan = async (loanId: string): Promise<LoanTranche[]> => {
    return db
        .select()
        .from(loanTranches)
        .where(eq(loanTranches.loanId, loanId))
        .orderBy(asc(loanTranches.trancheNumber));
};

/** Count the tranches already recorded for a loan, to number the next one. */
export const countByLoan = async (
    loanId: string,
    executor: Executor = db,
): Promise<number> => {
    const [row] = await executor
        .select({ total: sql<number>`count(*)::int` })
        .from(loanTranches)
        .where(eq(loanTranches.loanId, loanId));

    return row?.total ?? 0;
};

/** Insert a new tranche and return the created row. */
export const create = async (
    data: NewLoanTranche,
    executor: Executor = db,
): Promise<LoanTranche> => {
    const [row] = await executor.insert(loanTranches).values(data).returning();
    return row!;
};

/** Patch the loan's running disbursed-amount total after a new tranche. */
export const patchLoanDisbursedAmount = async (
    loanId: string,
    patch: { disbursedAmount: string; firstDisbursementDate: string },
    executor: Executor = db,
): Promise<void> => {
    await executor
        .update(loans)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(loans.id, loanId));
};
