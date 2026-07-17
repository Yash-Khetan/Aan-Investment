import {
    and,
    asc,
    desc,
    eq,
    getTableColumns,
    gte,
    ilike,
    isNull,
    lte,
    ne,
    or,
    sql,
    type SQL,
} from "drizzle-orm";

import { db } from "../../db/index";
import { borrowers, loans, loanTranches, users } from "../../db/schema";
import { SORTABLE_COLUMNS } from "./loan.constants";
import type {
    ListLoansQuery,
    LoanWithBorrower,
    NewLoan,
    NewLoanTranche,
} from "./loan.types";

/**
 * Loan data-access layer. Contains ONLY database concerns (queries, filtering,
 * pagination). No business rules live here. All reads exclude soft-deleted rows
 * (`deleted_at IS NULL`).
 */

/** The Drizzle transaction handle handed to `db.transaction()`'s callback. */
type Transaction = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/** The database executor: the singleton `db`, or a transaction handle. */
type Executor = typeof db | Transaction;

const notDeleted = isNull(loans.deletedAt);

const loanColumns = getTableColumns(loans);

/**
 * Insert a new loan and return the created row. Pass a transaction handle to
 * make this atomic with a related write (e.g. the initial disbursement
 * tranche in `loan.service.ts`).
 */
export const create = async (
    data: NewLoan,
    executor: Executor = db,
): Promise<LoanWithBorrower> => {
    const [row] = await executor.insert(loans).values(data).returning();
    // Re-read with borrower name for a consistent response shape.
    const created = await findById(row!.id, executor);
    return created!;
};

/** Fetch a single non-deleted loan enriched with the borrower name. */
export const findById = async (
    id: string,
    executor: Executor = db,
): Promise<LoanWithBorrower | undefined> => {
    const [row] = await executor
        .select({ ...loanColumns, borrowerName: borrowers.name })
        .from(loans)
        .leftJoin(borrowers, eq(loans.borrowerId, borrowers.id))
        .where(and(eq(loans.id, id), notDeleted))
        .limit(1);

    return row as LoanWithBorrower | undefined;
};

const buildFilters = (query: ListLoansQuery): SQL[] => {
    const filters: SQL[] = [notDeleted];

    if (query.search) {
        const term = `%${query.search}%`;
        const searchCondition = or(
            ilike(loans.loanAccountNumber, term),
            ilike(loans.purpose, term),
        );
        if (searchCondition) filters.push(searchCondition);
    }

    if (query.status) filters.push(eq(loans.status, query.status));
    if (query.loanType) filters.push(eq(loans.loanType, query.loanType));
    if (query.securityType)
        filters.push(eq(loans.securityType, query.securityType));
    if (query.borrowerId) filters.push(eq(loans.borrowerId, query.borrowerId));
    if (query.relationshipManagerId)
        filters.push(
            eq(loans.relationshipManagerId, query.relationshipManagerId),
        );

    if (query.minSanctionedAmount !== undefined)
        filters.push(
            gte(loans.sanctionedAmount, String(query.minSanctionedAmount)),
        );
    if (query.maxSanctionedAmount !== undefined)
        filters.push(
            lte(loans.sanctionedAmount, String(query.maxSanctionedAmount)),
        );

    if (query.sanctionDateFrom)
        filters.push(gte(loans.sanctionDate, query.sanctionDateFrom));
    if (query.sanctionDateTo)
        filters.push(lte(loans.sanctionDate, query.sanctionDateTo));

    return filters;
};

/** Paginated, filtered, sorted list plus the total matching count. */
export const findAll = async (
    query: ListLoansQuery,
): Promise<{ rows: LoanWithBorrower[]; total: number }> => {
    const filters = buildFilters(query);
    const whereClause = and(...filters);

    const sortColumn = SORTABLE_COLUMNS[query.sortBy];
    const orderBy = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const offset = (query.page - 1) * query.limit;

    const rows = await db
        .select({ ...loanColumns, borrowerName: borrowers.name })
        .from(loans)
        .leftJoin(borrowers, eq(loans.borrowerId, borrowers.id))
        .where(whereClause)
        .orderBy(orderBy)
        .limit(query.limit)
        .offset(offset);

    const [countRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(loans)
        .where(whereClause);

    return {
        rows: rows as LoanWithBorrower[],
        total: countRow?.total ?? 0,
    };
};

/** Apply a partial update to a non-deleted loan; returns the updated row. */
export const update = async (
    id: string,
    data: Partial<NewLoan>,
    executor: Executor = db,
): Promise<LoanWithBorrower | undefined> => {
    const [row] = await executor
        .update(loans)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(loans.id, id), notDeleted))
        .returning({ id: loans.id });

    if (!row) return undefined;
    return findById(row.id, executor);
};

/**
 * Count the tranches already recorded for a loan, so the caller can number
 * the next one. Not scoped to a transaction executor beyond what's passed in,
 * since tranches are never soft-deleted (no `deletedAt` column).
 */
export const countTranches = async (
    loanId: string,
    executor: Executor = db,
): Promise<number> => {
    const [row] = await executor
        .select({ total: sql<number>`count(*)::int` })
        .from(loanTranches)
        .where(eq(loanTranches.loanId, loanId));

    return row?.total ?? 0;
};

/**
 * Record a disbursement tranche. Called whenever a loan's `disbursedAmount`
 * is set (on create) or increased (on update) — see `loan.service.ts`. Pass
 * the same transaction handle used for the loan write so the two commit
 * together.
 */
export const createTranche = async (
    data: NewLoanTranche,
    executor: Executor = db,
): Promise<void> => {
    await executor.insert(loanTranches).values(data);
};

/** Soft-delete a loan by stamping `deleted_at`. Returns the affected id. */
export const softDelete = async (
    id: string,
): Promise<{ id: string } | undefined> => {
    const [row] = await db
        .update(loans)
        .set({ deletedAt: new Date() })
        .where(and(eq(loans.id, id), notDeleted))
        .returning({ id: loans.id });

    return row;
};

/** True if a non-deleted loan already uses this account number. */
export const existsByLoanAccountNumber = async (
    loanAccountNumber: string,
    excludeId?: string,
): Promise<boolean> => {
    const conditions: SQL[] = [
        eq(loans.loanAccountNumber, loanAccountNumber),
        notDeleted,
    ];
    if (excludeId) conditions.push(ne(loans.id, excludeId));

    const [row] = await db
        .select({ id: loans.id })
        .from(loans)
        .where(and(...conditions))
        .limit(1);

    return Boolean(row);
};

/** True if a non-deleted borrower exists with this id. */
export const borrowerExists = async (id: string): Promise<boolean> => {
    const [row] = await db
        .select({ id: borrowers.id })
        .from(borrowers)
        .where(and(eq(borrowers.id, id), isNull(borrowers.deletedAt)))
        .limit(1);

    return Boolean(row);
};

/** True if a non-deleted user (relationship manager) exists with this id. */
export const userExists = async (id: string): Promise<boolean> => {
    const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .limit(1);

    return Boolean(row);
};
