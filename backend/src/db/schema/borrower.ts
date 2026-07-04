import {
    pgTable,
    uuid,
    varchar,
    text,
    date,
    numeric,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import {
    constitutionEnum,
    entityStatusEnum,
    money,
    timestamps,
} from "./shared";

import { users } from "./auth";

/* ============================================================
   BORROWERS
============================================================ */

export const borrowers = pgTable("borrowers", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    borrowerCode: varchar("borrower_code", {
        length: 50,
    }).notNull(),

    name: varchar("name", {
        length: 255,
    }).notNull(),

    constitution: constitutionEnum("constitution")
        .notNull(),

    /* ── Contact ── */

    email: varchar("email", {
        length: 255,
    }),

    phone: varchar("phone", {
        length: 20,
    }),

    alternatePhone: varchar("alternate_phone", {
        length: 20,
    }),

    /* ── Address ── */

    addressLine1: text("address_line_1"),

    addressLine2: text("address_line_2"),

    city: varchar("city", {
        length: 100,
    }),

    state: varchar("state", {
        length: 100,
    }),

    pincode: varchar("pincode", {
        length: 10,
    }),

    /* ── Identity ── */

    pan: varchar("pan", {
        length: 10,
    }),

    gst: varchar("gst", {
        length: 20,
    }),

    cin: varchar("cin", {
        length: 25,
    }),

    /* ── Business Details ── */

    dateOfIncorporation: date("date_of_incorporation"),

    natureOfBusiness: text("nature_of_business"),

    /* ── Internal Rating ── */

    internalRating: varchar("internal_rating", {
        length: 10,
    }),

    ratingRemarks: text("rating_remarks"),

    /* ── Relationship Manager ── */

    relationshipManagerId: uuid("relationship_manager_id")
        .references(() => users.id),

    /* ── Status ── */

    status: entityStatusEnum("status")
        .default("ACTIVE"),

    notes: text("notes"),

    ...timestamps,

}, (table) => ({

    borrowerCodeIdx: uniqueIndex("borrower_code_idx")
        .on(table.borrowerCode),

    borrowerPanIdx: index("borrower_pan_idx")
        .on(table.pan),

    borrowerRmIdx: index("borrower_rm_idx")
        .on(table.relationshipManagerId),

}));

/* ============================================================
   PROMOTERS
============================================================ */

export const promoters = pgTable("promoters", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    borrowerId: uuid("borrower_id")
        .references(() => borrowers.id, {
            onDelete: "cascade",
        })
        .notNull(),

    name: varchar("name", {
        length: 255,
    }).notNull(),

    designation: varchar("designation", {
        length: 150,
    }),

    pan: varchar("pan", {
        length: 10,
    }),

    aadhar: varchar("aadhar", {
        length: 12,
    }),

    din: varchar("din", {
        length: 20,
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

    shareholdingPercent: numeric("shareholding_percent", {
        precision: 5,
        scale: 2,
    }),

    ...timestamps,

}, (table) => ({

    promoterBorrowerIdx: index("promoter_borrower_idx")
        .on(table.borrowerId),

}));

/* ============================================================
   GUARANTORS
============================================================ */

export const guarantors = pgTable("guarantors", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    borrowerId: uuid("borrower_id")
        .references(() => borrowers.id, {
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

    guarantorBorrowerIdx: index("guarantor_borrower_idx")
        .on(table.borrowerId),

}));
