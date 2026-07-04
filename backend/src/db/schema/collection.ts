import {
    pgTable,
    uuid,
    varchar,
    text,
    boolean,
    date,
    integer,
    index,
} from "drizzle-orm/pg-core";

import {
    collectionStatusEnum,
    money,
    timestamps,
} from "./shared";

import { loans } from "./loan";
import { borrowers } from "./borrower";
import { users } from "./auth";

/* ============================================================
   COLLECTION CASES
============================================================ */

export const collectionCases = pgTable("collection_cases", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanId: uuid("loan_id")
        .references(() => loans.id)
        .notNull(),

    borrowerId: uuid("borrower_id")
        .references(() => borrowers.id)
        .notNull(),

    status: collectionStatusEnum("status")
        .default("OPEN"),

    assignedTo: uuid("assigned_to")
        .references(() => users.id),

    priority: integer("priority")
        .default(0),

    overdueAmount: money("overdue_amount"),

    nextFollowUpDate: date("next_follow_up_date"),

    resolutionDate: date("resolution_date"),

    remarks: text("remarks"),

    ...timestamps,

}, (table) => ({

    collectionLoanIdx: index("collection_loan_idx")
        .on(table.loanId),

    collectionStatusIdx: index("collection_status_idx")
        .on(table.status),

    collectionAssignedIdx: index("collection_assigned_idx")
        .on(table.assignedTo),

    collectionFollowUpIdx: index("collection_follow_up_idx")
        .on(table.nextFollowUpDate),

}));

/* ============================================================
   FOLLOW-UPS
============================================================ */

export const followUps = pgTable("follow_ups", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    collectionCaseId: uuid("collection_case_id")
        .references(() => collectionCases.id, {
            onDelete: "cascade",
        })
        .notNull(),

    followUpDate: date("follow_up_date")
        .notNull(),

    followUpType: varchar("follow_up_type", {
        length: 50,
    }).notNull(),

    contactPerson: varchar("contact_person", {
        length: 255,
    }),

    remarks: text("remarks"),

    followUpBy: uuid("follow_up_by")
        .references(() => users.id),

    /* ── Promise to Pay ── */

    promiseDate: date("promise_date"),

    promiseAmount: money("promise_amount"),

    promiseKept: boolean("promise_kept"),

    ...timestamps,

}, (table) => ({

    followUpCaseIdx: index("follow_up_case_idx")
        .on(table.collectionCaseId),

    followUpDateIdx: index("follow_up_date_idx")
        .on(table.followUpDate),

}));
