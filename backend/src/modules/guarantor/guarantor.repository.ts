import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../db/index";
import { guarantors, loans } from "../../db/schema";
import type { NewGuarantor } from "./guarantor.types";

/**
 * Guarantor data-access layer. Database concerns only — no business rules.
 * All reads exclude soft-deleted guarantors (`deleted_at IS NULL`).
 */

const notDeleted = isNull(guarantors.deletedAt);

/** Insert a guarantor against a loan and return the created row. */
export const create = async (data: NewGuarantor) => {
    const [row] = await db.insert(guarantors).values(data).returning();
    return row!;
};

/** All non-deleted guarantors for a loan. */
export const findAllByLoanId = async (loanId: string) => {
    return db
        .select()
        .from(guarantors)
        .where(and(eq(guarantors.loanId, loanId), notDeleted));
};

/** Single non-deleted guarantor by id. */
export const findById = async (id: string) => {
    const [row] = await db
        .select()
        .from(guarantors)
        .where(and(eq(guarantors.id, id), notDeleted))
        .limit(1);

    return row;
};

/** Apply a partial update to a non-deleted guarantor; returns the updated row. */
export const update = async (id: string, data: Partial<NewGuarantor>) => {
    const [row] = await db
        .update(guarantors)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(guarantors.id, id), notDeleted))
        .returning();

    return row;
};

/** Soft-delete a guarantor by stamping `deleted_at`. */
export const softDelete = async (id: string) => {
    const [row] = await db
        .update(guarantors)
        .set({ deletedAt: new Date() })
        .where(and(eq(guarantors.id, id), notDeleted))
        .returning({ id: guarantors.id });

    return row;
};

/** True if a non-deleted loan exists with this id. */
export const loanExists = async (loanId: string): Promise<boolean> => {
    const [row] = await db
        .select({ id: loans.id })
        .from(loans)
        .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)))
        .limit(1);

    return Boolean(row);
};
