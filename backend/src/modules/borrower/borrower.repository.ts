import {
    and,
    asc,
    desc,
    eq,
    getTableColumns,
    ilike,
    isNull,
    ne,
    or,
    sql,
    type SQL,
} from "drizzle-orm";

import { db } from "../../db/index";
import {
    borrowers,
    guarantors,
    promoters,
    users,
} from "../../db/schema";
import { SORTABLE_COLUMNS } from "./borrower.constants";
import type {
    BorrowerDetail,
    BorrowerWithManager,
    ListBorrowersQuery,
    NewBorrower,
    NewGuarantor,
    NewPromoter,
} from "./borrower.types";

/**
 * Borrower data-access layer. Database concerns only — no business rules.
 * All reads exclude soft-deleted borrowers (`deleted_at IS NULL`).
 */

const notDeleted = isNull(borrowers.deletedAt);
const borrowerColumns = getTableColumns(borrowers);

/** Full name of the relationship manager, or NULL when unassigned. */
const managerName = sql<string | null>`case when ${users.id} is null then null else trim(concat(${users.firstName}, ' ', coalesce(${users.lastName}, ''))) end`;

/**
 * Insert a borrower and its optional child entities in a single transaction,
 * then return the full detail view.
 */
export const create = async (
    data: NewBorrower,
    children: {
        promoters: Omit<NewPromoter, "borrowerId">[];
        guarantors: Omit<NewGuarantor, "borrowerId">[];
    },
): Promise<BorrowerDetail> => {
    const id = await db.transaction(async (tx) => {
        const [row] = await tx
            .insert(borrowers)
            .values(data)
            .returning({ id: borrowers.id });
        const borrowerId = row!.id;

        if (children.promoters.length > 0) {
            await tx
                .insert(promoters)
                .values(children.promoters.map((p) => ({ ...p, borrowerId })));
        }
        if (children.guarantors.length > 0) {
            await tx
                .insert(guarantors)
                .values(children.guarantors.map((g) => ({ ...g, borrowerId })));
        }
        return borrowerId;
    });

    const detail = await findById(id);
    return detail!;
};

/** Single non-deleted borrower with manager name and child entities. */
export const findById = async (
    id: string,
): Promise<BorrowerDetail | undefined> => {
    const [row] = await db
        .select({ ...borrowerColumns, relationshipManagerName: managerName })
        .from(borrowers)
        .leftJoin(users, eq(borrowers.relationshipManagerId, users.id))
        .where(and(eq(borrowers.id, id), notDeleted))
        .limit(1);

    if (!row) return undefined;

    const [promoterRows, guarantorRows] = await Promise.all([
        db.select().from(promoters).where(eq(promoters.borrowerId, id)),
        db.select().from(guarantors).where(eq(guarantors.borrowerId, id)),
    ]);

    return {
        ...(row as BorrowerWithManager),
        promoters: promoterRows,
        guarantors: guarantorRows,
    };
};

const buildFilters = (query: ListBorrowersQuery): SQL[] => {
    const filters: SQL[] = [notDeleted];

    if (query.search) {
        const term = `%${query.search}%`;
        const searchCondition = or(
            ilike(borrowers.name, term),
            ilike(borrowers.borrowerCode, term),
            ilike(borrowers.pan, term),
            ilike(borrowers.gst, term),
        );
        if (searchCondition) filters.push(searchCondition);
    }

    if (query.status) filters.push(eq(borrowers.status, query.status));
    if (query.constitution)
        filters.push(eq(borrowers.constitution, query.constitution));
    if (query.relationshipManagerId)
        filters.push(
            eq(borrowers.relationshipManagerId, query.relationshipManagerId),
        );

    return filters;
};

/** Paginated, filtered, sorted list plus total matching count. */
export const findAll = async (
    query: ListBorrowersQuery,
): Promise<{ rows: BorrowerWithManager[]; total: number }> => {
    const filters = buildFilters(query);
    const whereClause = and(...filters);

    const sortColumn = SORTABLE_COLUMNS[query.sortBy];
    const orderBy = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
    const offset = (query.page - 1) * query.limit;

    const rows = await db
        .select({ ...borrowerColumns, relationshipManagerName: managerName })
        .from(borrowers)
        .leftJoin(users, eq(borrowers.relationshipManagerId, users.id))
        .where(whereClause)
        .orderBy(orderBy)
        .limit(query.limit)
        .offset(offset);

    const [countRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(borrowers)
        .where(whereClause);

    return {
        rows: rows as BorrowerWithManager[],
        total: countRow?.total ?? 0,
    };
};

/** Apply a partial update to a non-deleted borrower; returns the detail view. */
export const update = async (
    id: string,
    data: Partial<NewBorrower>,
): Promise<BorrowerDetail | undefined> => {
    const [row] = await db
        .update(borrowers)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(borrowers.id, id), notDeleted))
        .returning({ id: borrowers.id });

    if (!row) return undefined;
    return findById(row.id);
};

/** Soft-delete a borrower by stamping `deleted_at`. */
export const softDelete = async (
    id: string,
): Promise<{ id: string } | undefined> => {
    const [row] = await db
        .update(borrowers)
        .set({ deletedAt: new Date() })
        .where(and(eq(borrowers.id, id), notDeleted))
        .returning({ id: borrowers.id });

    return row;
};

/** True if a non-deleted borrower already uses this borrower code. */
export const existsByBorrowerCode = async (
    borrowerCode: string,
    excludeId?: string,
): Promise<boolean> => {
    const conditions: SQL[] = [
        eq(borrowers.borrowerCode, borrowerCode),
        notDeleted,
    ];
    if (excludeId) conditions.push(ne(borrowers.id, excludeId));

    const [row] = await db
        .select({ id: borrowers.id })
        .from(borrowers)
        .where(and(...conditions))
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
