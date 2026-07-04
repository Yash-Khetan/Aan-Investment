import {
    pgTable,
    uuid,
    varchar,
    text,
    boolean,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import { timestamps } from "./shared";

/* ============================================================
   SYSTEM SETTINGS
============================================================ */

export const systemSettings = pgTable("system_settings", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    key: varchar("key", {
        length: 100,
    }).notNull(),

    value: text("value"),

    description: text("description"),

    category: varchar("category", {
        length: 100,
    }),

    isEditable: boolean("is_editable")
        .default(true),

    ...timestamps,

}, (table) => ({

    settingKeyIdx: uniqueIndex("setting_key_idx")
        .on(table.key),

}));
