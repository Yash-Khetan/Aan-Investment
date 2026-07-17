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
============================================================ */

export const auditLogs = pgTable("audit_logs", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    userId: uuid("user_id")
        .references(() => users.id),

    action: auditActionEnum("action")
        .notNull(),

    entityType: varchar("entity_type", {
        length: 100,
    }).notNull(),

    entityId: uuid("entity_id"),

    oldValues: jsonb("old_values"),

    newValues: jsonb("new_values"),

    ipAddress: varchar("ip_address", {
        length: 100,
    }),

    userAgent: text("user_agent"),

    description: text("description"),

    createdAt: timestamp("created_at", {
        withTimezone: true,
    }).defaultNow(),

}, (table) => ({

    auditUserIdx: index("audit_user_idx")
        .on(table.userId),

    auditEntityIdx: index("audit_entity_idx")
        .on(table.entityType, table.entityId),

    auditActionIdx: index("audit_action_idx")
        .on(table.action),

    auditCreatedIdx: index("audit_created_idx")
        .on(table.createdAt),

}));
