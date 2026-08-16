import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "../../db/index";
import { borrowers, promoters } from "../../db/schema";
import type { NewPromoter } from "./borrower.types";

/**
 * Related-person (promoter) data-access layer. Database concerns only — no
 * business rules. All reads exclude soft-deleted rows (`deleted_at IS NULL`).
 */

const notDeleted = isNull(promoters.deletedAt);

/**
 * Timestamps are taken from the database clock, not the app's.
 *
 * `created_at` defaults to the DB's `now()`, so stamping edits with the Node
 * process's `new Date()` mixes two clocks: when they are even slightly skewed,
 * an update can land *before* the insert it modifies and the audit trail reads
 * as nonsense. Using `now()` keeps every timestamp on one clock.
 */
const dbNow = sql`now()`;

/** Insert a related person against a borrower and return the created row. */
export const create = async (data: NewPromoter) => {
    const [row] = await db.insert(promoters).values(data).returning();
    return row!;
};

/** All non-deleted related persons for a borrower, oldest first. */
export const findAllByBorrowerId = async (borrowerId: string) =>
    db
        .select()
        .from(promoters)
        .where(and(eq(promoters.borrowerId, borrowerId), notDeleted))
        .orderBy(asc(promoters.createdAt));

/** Single non-deleted related person by id. */
export const findById = async (id: string) => {
    const [row] = await db
        .select()
        .from(promoters)
        .where(and(eq(promoters.id, id), notDeleted))
        .limit(1);

    return row;
};

/** Apply a partial update to a non-deleted related person; returns the row. */
export const update = async (id: string, data: Partial<NewPromoter>) => {
    const [row] = await db
        .update(promoters)
        .set({ ...data, updatedAt: dbNow })
        .where(and(eq(promoters.id, id), notDeleted))
        .returning();

    return row;
};

/** Soft-delete a related person by stamping `deleted_at`. */
export const softDelete = async (id: string) => {
    const [row] = await db
        .update(promoters)
        .set({ deletedAt: dbNow, updatedAt: dbNow })
        .where(and(eq(promoters.id, id), notDeleted))
        .returning({ id: promoters.id });

    return row;
};

/** The borrower's type, or undefined when no non-deleted borrower has this id. */
export const findBorrowerType = async (
    borrowerId: string,
): Promise<(typeof borrowers.$inferSelect)["borrowerType"] | undefined> => {
    const [row] = await db
        .select({ borrowerType: borrowers.borrowerType })
        .from(borrowers)
        .where(and(eq(borrowers.id, borrowerId), isNull(borrowers.deletedAt)))
        .limit(1);

    return row?.borrowerType;
};
