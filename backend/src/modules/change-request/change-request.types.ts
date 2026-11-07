import type { changeRequests } from "../../db/schema";
import type { RequestActor } from "../../common/http/actor";

export type { RequestActor };

/** The kinds of records a change request can be filed against. */
export type ChangeRequestEntityType =
    | "LOAN"
    | "COLLATERAL"
    | "COLLATERAL_INSURANCE"
    | "LEDGER_ENTRY"
    | "LEDGER_IMPORT";

export type ChangeRequestAction = "CREATE" | "UPDATE" | "DELETE";

export type ChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

/** A `change_requests` row exactly as Drizzle returns it. */
export type ChangeRequestRow = typeof changeRequests.$inferSelect;

export interface SubmitChangeRequestInput {
    entityType: ChangeRequestEntityType;
    /** Null for a CREATE request — the record does not exist yet. */
    entityId: string | null;
    action: ChangeRequestAction;
    /** Only the money-field subset being requested — never the whole record. */
    payload: unknown;
    /** Snapshot of those same fields as they stood when requested, for the diff view. */
    previousValues?: unknown;
    /** The loan this change ultimately affects, whatever entityType it is filed under. */
    loanId: string | null;
    requestedBy: string;
}

export interface ListChangeRequestsFilters {
    status?: ChangeRequestStatus;
    entityType?: ChangeRequestEntityType;
    loanId?: string;
    requestedBy?: string;
    page?: number;
    limit?: number;
}

/**
 * One applier per (entityType, action) — the function that actually performs
 * the entity's DB write when a request is approved. Each applier is just the
 * existing, already-tested service function for that action; this module
 * never reimplements the write itself.
 */
export type ChangeRequestApplier = (payload: unknown, entityId: string | null) => Promise<unknown>;
