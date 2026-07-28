import {
    pgTable,
    uuid,
    varchar,
    text,
    index,
} from "drizzle-orm/pg-core";

import {
    money,
    timestamps,
} from "./shared";

import { loans } from "./loan";

/* ============================================================
   GUARANTORS
============================================================ */

export const guarantors = pgTable("guarantors", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanId: uuid("loan_id")
        .references(() => loans.id, {
            onDelete: "cascade",
        })
        .notNull(),

    name: varchar("name", {
        length: 255,
    }).notNull(),

    guaranteeType: varchar("guarantee_type", {
        length: 50,
    }).notNull(),

    pan: varchar("pan", {
        length: 10,
    }),

    phone: varchar("phone", {
        length: 20,
    }),

    email: varchar("email", {
        length: 255,
    }),

    addressLine1: text("address_line_1"),

    city: varchar("city", {
        length: 100,
    }),

    state: varchar("state", {
        length: 100,
    }),

    pincode: varchar("pincode", {
        length: 10,
    }),

    netWorth: money("net_worth"),

    ...timestamps,

}, (table) => ({

    guarantorLoanIdx: index("guarantor_loan_idx")
        .on(table.loanId),

}));
