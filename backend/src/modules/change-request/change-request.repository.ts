import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "../../db/index";
import { changeRequests } from "../../db/schema";
import type {
    ChangeRequestRow,
    ListChangeRequestsFilters,
    SubmitChangeRequestInput,
} from "./change-request.types";

/**
 * Change-request data-access layer. Database concerns only — no business
 * rules (approval/rejection logic lives in change-request.service.ts).
 */

export const insert = async (input: SubmitChangeRequestInput): Promise<ChangeRequestRow> => {
    const [row] = await db
        .insert(changeRequests)
        .values({
            entityType: input.entityType,
            entityId: input.entityId,
            action: input.action,
            payload: input.payload,
            previousValues: input.previousValues ?? null,
            loanId: input.loanId,
            requestedBy: input.requestedBy,
        })
        .returning();

    return row!;
};

export const findById = async (id: string): Promise<ChangeRequestRow | undefined> => {
    const [row] = await db
        .select()
        .from(changeRequests)
        .where(eq(changeRequests.id, id))
        .limit(1);

    return row;
};

export const findByIds = async (ids: string[]): Promise<ChangeRequestRow[]> => {
    if (ids.length === 0) return [];
    return db.select().from(changeRequests).where(inArray(changeRequests.id, ids));
};

/** Builds the WHERE clause shared by every list query below. */
const buildFilters = (filters: ListChangeRequestsFilters) => {
    const clauses = [];
    if (filters.status) clauses.push(eq(changeRequests.status, filters.status));
    if (filters.entityType) clauses.push(eq(changeRequests.entityType, filters.entityType));
    if (filters.loanId) clauses.push(eq(changeRequests.loanId, filters.loanId));
    if (filters.requestedBy) clauses.push(eq(changeRequests.requestedBy, filters.requestedBy));
    return clauses.length > 0 ? and(...clauses) : undefined;
};

export const list = async (filters: ListChangeRequestsFilters): Promise<ChangeRequestRow[]> => {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;

    return db
        .select()
        .from(changeRequests)
        .where(buildFilters(filters))
        .orderBy(desc(changeRequests.requestedAt))
        .limit(limit)
        .offset((page - 1) * limit);
};

/** All PENDING ids matching the given scope — used by approve-all/reject-all. */
export const listPendingIds = async (
    filters: Omit<ListChangeRequestsFilters, "status" | "page" | "limit">,
): Promise<string[]> => {
    const rows = await db
        .select({ id: changeRequests.id })
        .from(changeRequests)
        .where(buildFilters({ ...filters, status: "PENDING" }));

    return rows.map((r) => r.id);
};

/** Distinct loan ids with at least one PENDING change request — powers the list-page badge. */
export const listPendingLoanIds = async (): Promise<string[]> => {
    const rows = await db
        .selectDistinct({ loanId: changeRequests.loanId })
        .from(changeRequests)
        .where(eq(changeRequests.status, "PENDING"));

    return rows.map((r) => r.loanId).filter((id): id is string => id !== null);
};

export const markReviewed = async (
    id: string,
    patch: { status: "APPROVED" | "REJECTED"; reviewedBy: string; reviewNotes?: string | null },
): Promise<ChangeRequestRow | undefined> => {
    const [row] = await db
        .update(changeRequests)
        .set({
            status: patch.status,
            reviewedBy: patch.reviewedBy,
            reviewedAt: new Date(),
            reviewNotes: patch.reviewNotes ?? null,
        })
        .where(eq(changeRequests.id, id))
        .returning();

    return row;
};

/** Backfills the real entity id onto a CREATE request once it has been approved and inserted. */
export const setEntityId = async (id: string, entityId: string): Promise<void> => {
    await db.update(changeRequests).set({ entityId }).where(eq(changeRequests.id, id));
};
