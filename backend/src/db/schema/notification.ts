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
import { borrowers } from "./borrower";
import { loans } from "./loan";

/* ============================================================
   NOTIFICATIONS
============================================================ */

export const notifications = pgTable("notifications", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    // Optional for external borrower/guarantor notifications
    userId: uuid("user_id")
        .references(() => users.id, {
            onDelete: "set null",
        }),

    borrowerId: uuid("borrower_id")
        .references(() => borrowers.id, {
            onDelete: "set null",
        }),

    loanId: uuid("loan_id")
        .references(() => loans.id, {
            onDelete: "set null",
        }),

    recipient: varchar("recipient", {
        length: 255,
    }),

    title: varchar("title", {
        length: 255,
    }).notNull(),

    message: text("message"),

    type: varchar("type", {
        length: 50,
    }),

    triggerType: varchar("trigger_type", {
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

    notifBorrowerIdx: index("notif_borrower_idx")
        .on(table.borrowerId),

    notifLoanIdx: index("notif_loan_idx")
        .on(table.loanId),

    notifChannelIdx: index("notif_channel_idx")
        .on(table.channel),

    notifStatusIdx: index("notif_status_idx")
        .on(table.status),

    notifCreatedAtIdx: index("notif_created_at_idx")
        .on(table.createdAt),

}));

