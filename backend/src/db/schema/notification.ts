import {
    pgTable,
    uuid,
    varchar,
    text,
    boolean,
    timestamp,
    index,
} from "drizzle-orm/pg-core";

import { timestamps, reminderChannelEnum, notificationStatusEnum } from "./shared";
import { users } from "./auth";

/* ============================================================
   NOTIFICATIONS
============================================================ */

export const notifications = pgTable("notifications", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    userId: uuid("user_id")
        .references(() => users.id, {
            onDelete: "cascade",
        })
        .notNull(),

    title: varchar("title", {
        length: 255,
    }).notNull(),

    message: text("message"),

    type: varchar("type", {
        length: 50,
    }),

    channel: reminderChannelEnum("channel")
        .notNull(),

    status: notificationStatusEnum("status")
        .notNull(),

    isRead: boolean("is_read")
        .default(false),

    readAt: timestamp("read_at", {
        withTimezone: true,
    }),

    link: text("link"),

    ...timestamps,

}, (table) => ({

    notifUserIdx: index("notif_user_idx")
        .on(table.userId),

    notifReadIdx: index("notif_read_idx")
        .on(table.userId, table.isRead),

    notifChannelIdx: index("notif_channel_idx")
        .on(table.channel),

    notifStatusIdx: index("notif_status_idx")
        .on(table.status),

}));
