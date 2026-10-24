import {
    pgTable,
    uuid,
    varchar,
    text,
    jsonb,
    timestamp,
    index,
} from "drizzle-orm/pg-core";

import { auditActionEnum } from "./shared";
import { users } from "./auth";

/* ============================================================
   AUDIT LOGS

   One row per change a person made to a record that has to be
   answerable for afterwards: who, when, which record, and what
   the values were before and after.

   Append-only. Nothing in the application updates or deletes a
   row here, and the table carries no `deleted_at` for that
   reason — an audit trail that can be edited is not one. The
   user reference is ON DELETE SET NULL so a removed account
   cannot take its trail with it.

   `old_values` / `new_values` hold only the fields that actually
   changed, already passed through the audit service's redaction
   (see modules/audit) — never a whole row verbatim, and never a
   secret, token or password hash.
============================================================ */

export const auditLogs = pgTable("audit_logs", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    /** Who did it. Null for a system action, or once the account is deleted. */
    userId: uuid("user_id")
        .references(() => users.id, {
            onDelete: "set null",
        }),

    action: auditActionEnum("action")
        .notNull(),

    /** The kind of record acted on, e.g. "LEDGER_ENTRY" or "LEDGER_IMPORT". */
    entityType: varchar("entity_type", { length: 50 })
        .notNull(),

    /** The record's own id. Not a foreign key: the row survives the record it describes. */
    entityId: uuid("entity_id")
        .notNull(),

    /** The changed fields as they were. Null on a CREATE. */
    oldValues: jsonb("old_values"),

    /** The changed fields as they became. Null on a DELETE. */
    newValues: jsonb("new_values"),

    ipAddress: varchar("ip_address", { length: 45 }),

    userAgent: text("user_agent"),

    /** Written by the database's own clock, so the trail reads in one order. */
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),

}, (table) => ({

    auditEntityIdx: index("audit_entity_idx")
        .on(table.entityType, table.entityId),

    auditUserIdx: index("audit_user_idx")
        .on(table.userId),

    auditCreatedAtIdx: index("audit_created_at_idx")
        .on(table.createdAt),

}));
