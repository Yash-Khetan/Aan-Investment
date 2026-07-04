import {
    pgTable,
    uuid,
    varchar,
    text,
    boolean,
    date,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import {
    accountingEntryTypeEnum,
    money,
    timestamps,
} from "./shared";

import { loans } from "./loan";
import { payments } from "./payment";

/* ============================================================
   JOURNAL ENTRIES
============================================================ */

export const journalEntries = pgTable("journal_entries", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    entryNumber: varchar("entry_number", {
        length: 50,
    }).notNull(),

    loanId: uuid("loan_id")
        .references(() => loans.id),

    paymentId: uuid("payment_id")
        .references(() => payments.id),

    entryType: accountingEntryTypeEnum("entry_type")
        .notNull(),

    entryDate: date("entry_date")
        .notNull(),

    narration: text("narration"),

    isPosted: boolean("is_posted")
        .default(false),

    isExported: boolean("is_exported")
        .default(false),

    ...timestamps,

}, (table) => ({

    journalEntryNumberIdx: uniqueIndex("journal_entry_number_idx")
        .on(table.entryNumber),

    journalLoanIdx: index("journal_loan_idx")
        .on(table.loanId),

    journalDateIdx: index("journal_date_idx")
        .on(table.entryDate),

}));

/* ============================================================
   JOURNAL ENTRY LINES (Debit / Credit Legs)
============================================================ */

export const journalEntryLines = pgTable("journal_entry_lines", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    journalEntryId: uuid("journal_entry_id")
        .references(() => journalEntries.id, {
            onDelete: "cascade",
        })
        .notNull(),

    accountCode: varchar("account_code", {
        length: 50,
    }).notNull(),

    accountName: varchar("account_name", {
        length: 255,
    }),

    debitAmount: money("debit_amount")
        .default("0"),

    creditAmount: money("credit_amount")
        .default("0"),

    narration: text("narration"),

    ...timestamps,

}, (table) => ({

    lineEntryIdx: index("line_entry_idx")
        .on(table.journalEntryId),

    lineAccountIdx: index("line_account_idx")
        .on(table.accountCode),

}));
