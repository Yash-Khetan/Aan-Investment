import {
    pgTable,
    uuid,
    varchar,
    text,
    date,
    timestamp,
    index,
} from "drizzle-orm/pg-core";

import {
    reminderStatusEnum,
    reminderChannelEnum,
    timestamps,
} from "./shared";

import { loans } from "./loan";
import { borrowers } from "./borrower";

/* ============================================================
   REMINDERS
============================================================ */

export const reminders = pgTable("reminders", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanId: uuid("loan_id")
        .references(() => loans.id)
        .notNull(),

    borrowerId: uuid("borrower_id")
        .references(() => borrowers.id),

    channel: reminderChannelEnum("channel")
        .notNull(),

    scheduledDate: date("scheduled_date")
        .notNull(),

    sentAt: timestamp("sent_at", {
        withTimezone: true,
    }),

    status: reminderStatusEnum("status")
        .default("PENDING"),

    subject: varchar("subject", {
        length: 255,
    }),

    message: text("message"),

    recipientContact: varchar("recipient_contact", {
        length: 255,
    }),

    remarks: text("remarks"),

    ...timestamps,

}, (table) => ({

    reminderLoanIdx: index("reminder_loan_idx")
        .on(table.loanId),

    reminderStatusIdx: index("reminder_status_idx")
        .on(table.status),

    reminderDateIdx: index("reminder_date_idx")
        .on(table.scheduledDate),

}));
