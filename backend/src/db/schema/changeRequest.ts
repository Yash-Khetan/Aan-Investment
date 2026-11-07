import {
    pgTable,
    uuid,
    varchar,
    jsonb,
    text,
    timestamp,
    index,
} from "drizzle-orm/pg-core";

import { changeRequestActionEnum, changeRequestStatusEnum } from "./shared";
import { users } from "./auth";
import { loans } from "./loan";

/* ============================================================
   CHANGE REQUESTS

   A money-related change an employee submits (a loan's financial
   fields, a collateral's valuation/insurance, a ledger entry, a
   KPI-ledger import) does not touch its own table yet — it sits
   here, PENDING, until an admin approves or rejects it. Approving
   it calls the same service function an admin's own direct edit
   would have called; rejecting it leaves no trace anywhere else.

   `entityId` is nullable: a CREATE request (e.g. recording a new
   ledger entry) describes a record that does not exist yet, so
   there is nothing to point at until it is approved.

   `loanId` is denormalized onto every row — even when `entityType`
   is COLLATERAL, COLLATERAL_INSURANCE, LEDGER_ENTRY, or
   LEDGER_IMPORT — so "which loans have something pending" is one
   query, not a join across tables, for the list-page badge.
============================================================ */

export const changeRequests = pgTable("change_requests", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    /** The kind of record the change is about, e.g. "LOAN" or "LEDGER_ENTRY". */
    entityType: varchar("entity_type", { length: 50 })
        .notNull(),

    /** The record's own id. Null until a CREATE request is approved. Not a foreign key: the row survives the record it describes. */
    entityId: uuid("entity_id"),

    action: changeRequestActionEnum("action")
        .notNull(),

    /** The fields being requested — only the money-field subset, never the whole record. Null for a DELETE, which has nothing to apply beyond removing the record. */
    payload: jsonb("payload"),

    /** Snapshot of those same fields as they stood when requested, for the admin's diff view. */
    previousValues: jsonb("previous_values"),

    /** The loan this change ultimately affects, whatever entityType it is filed under. */
    loanId: uuid("loan_id")
        .references(() => loans.id, {
            onDelete: "set null",
        }),

    requestedBy: uuid("requested_by")
        .references(() => users.id, {
            onDelete: "set null",
        }),

    requestedAt: timestamp("requested_at", { withTimezone: true })
        .defaultNow()
        .notNull(),

    status: changeRequestStatusEnum("status")
        .default("PENDING")
        .notNull(),

    reviewedBy: uuid("reviewed_by")
        .references(() => users.id, {
            onDelete: "set null",
        }),

    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    reviewNotes: text("review_notes"),

}, (table) => ({

    changeRequestEntityIdx: index("change_request_entity_idx")
        .on(table.entityType, table.entityId),

    changeRequestStatusIdx: index("change_request_status_idx")
        .on(table.status),

    changeRequestRequestedByIdx: index("change_request_requested_by_idx")
        .on(table.requestedBy),

    changeRequestLoanIdx: index("change_request_loan_idx")
        .on(table.loanId),

}));
