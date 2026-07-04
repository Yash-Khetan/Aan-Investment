import {
    pgTable,
    uuid,
    varchar,
    text,
    boolean,
    timestamp,
    jsonb,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import { timestamps } from "./shared";
import { users } from "./auth";

/* ============================================================
   REPORT DEFINITIONS
============================================================ */

export const reportDefinitions = pgTable("report_definitions", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    name: varchar("name", {
        length: 255,
    }).notNull(),

    slug: varchar("slug", {
        length: 100,
    }).notNull(),

    description: text("description"),

    category: varchar("category", {
        length: 100,
    }),

    isActive: boolean("is_active")
        .default(true),

    ...timestamps,

}, (table) => ({

    reportSlugIdx: uniqueIndex("report_slug_idx")
        .on(table.slug),

}));

/* ============================================================
   REPORT RUNS
============================================================ */

export const reportRuns = pgTable("report_runs", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    reportDefinitionId: uuid("report_definition_id")
        .references(() => reportDefinitions.id)
        .notNull(),

    parameters: jsonb("parameters"),

    generatedBy: uuid("generated_by")
        .references(() => users.id),

    fileUrl: text("file_url"),

    format: varchar("format", {
        length: 20,
    }),

    status: varchar("status", {
        length: 20,
    }).default("PENDING"),

    startedAt: timestamp("started_at", {
        withTimezone: true,
    }),

    completedAt: timestamp("completed_at", {
        withTimezone: true,
    }),

    ...timestamps,

}, (table) => ({

    reportRunDefIdx: index("report_run_def_idx")
        .on(table.reportDefinitionId),

    reportRunUserIdx: index("report_run_user_idx")
        .on(table.generatedBy),

}));
