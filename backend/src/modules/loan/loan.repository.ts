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
import { borrowers, interestConfigs, loans, users } from "../../db/schema";
import { SORTABLE_COLUMNS } from "./loan.constants";
import type {
    ListLoansQuery,
    LoanWithBorrower,
    NewLoan,
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
 * What every loan read returns: the loan row, its borrower's name, and the
 * interest and TDS rate of its current interest configuration — the only
 * place those rates are stored. Every loan is created with a configuration in
 * the same transaction, so the join always finds one.
 */
const loanReadColumns = {
    ...loanColumns,
    borrowerName: borrowers.name,
    interestRate: sql<string>`${interestConfigs.annualRate}`,
    tdsRatePercent: sql<string>`${interestConfigs.tdsRatePercent}`,
};

const currentConfigJoin = and(eq(interestConfigs.loanId, loans.id), eq(interestConfigs.isCurrent, true));

/**
 * Insert a new loan and return its id. Pass a transaction handle to make this
 * atomic with its first interest configuration (see `loan.service.ts`).
 */
export const create = async (
    data: NewLoan,
    executor: Executor = db,
): Promise<string> => {
    const [row] = await executor.insert(loans).values(data).returning({ id: loans.id });
    return row!.id;
};

/** Fetch a single non-deleted loan enriched with the borrower name. */
export const findById = async (
    id: string,
    executor: Executor = db,
): Promise<LoanWithBorrower | undefined> => {
    const [row] = await executor
        .select(loanReadColumns)
        .from(loans)
        .leftJoin(borrowers, eq(loans.borrowerId, borrowers.id))
        .leftJoin(interestConfigs, currentConfigJoin)
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
        .select(loanReadColumns)
        .from(loans)
        .leftJoin(borrowers, eq(loans.borrowerId, borrowers.id))
        .leftJoin(interestConfigs, currentConfigJoin)
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
): Promise<boolean> => {
    const [row] = await executor
        .update(loans)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(loans.id, id), notDeleted))
        .returning({ id: loans.id });

    return Boolean(row);
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
