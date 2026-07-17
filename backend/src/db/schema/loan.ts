import {
    pgTable,
    uuid,
    varchar,
    text,
    date,
    integer,
    numeric,
    timestamp,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import {
    loanStatusEnum,
    loanTypeEnum,
    securityTypeEnum,
    repaymentTypeEnum,
    money,
    timestamps,
} from "./shared";

import { borrowers } from "./borrower";
import { users } from "./auth";

/* ============================================================
   LOANS
============================================================ */

export const loans = pgTable("loans", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanAccountNumber: varchar("loan_account_number", {
        length: 50,
    }).notNull(),

    borrowerId: uuid("borrower_id")
        .references(() => borrowers.id)
        .notNull(),

    loanType: loanTypeEnum("loan_type")
        .notNull(),

    securityType: securityTypeEnum("security_type")
        .default("NONE"),

    repaymentType: repaymentTypeEnum("repayment_type")
        .notNull(),

    /* ── Amounts ── */

    sanctionedAmount: money("sanctioned_amount")
        .notNull(),

    disbursedAmount: money("disbursed_amount")
        .default("0"),

    outstandingPrincipal: money("outstanding_principal")
        .default("0"),

    /* ── Interest ── */

    interestRate: numeric("interest_rate", {
        precision: 8,
        scale: 4,
    }).notNull(),

    /* ── Tenure ── */

    tenureMonths: integer("tenure_months")
        .notNull(),

    moratoriumMonths: integer("moratorium_months")
        .default(0),

    /* ── Key Dates ── */

    sanctionDate: date("sanction_date"),

    firstDisbursementDate: date("first_disbursement_date"),

    maturityDate: date("maturity_date"),

    /* ── Purpose & Remarks ── */

    purpose: text("purpose"),

    approvalNotes: text("approval_notes"),

    remarks: text("remarks"),

    /* ── Status ── */

    status: loanStatusEnum("status")
        .default("PENDING"),

    /* ── Tracking ── */

    createdBy: uuid("created_by")
        .references(() => users.id),

    relationshipManagerId: uuid("relationship_manager_id")
        .references(() => users.id),

    ...timestamps,

}, (table) => ({

    loanAccountIdx: uniqueIndex("loan_account_idx")
        .on(table.loanAccountNumber),

    loanBorrowerIdx: index("loan_borrower_idx")
        .on(table.borrowerId),

    loanStatusIdx: index("loan_status_idx")
        .on(table.status),

    loanRmIdx: index("loan_rm_idx")
        .on(table.relationshipManagerId),

}));

/* ============================================================
   LOAN TRANCHES
============================================================ */

export const loanTranches = pgTable("loan_tranches", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanId: uuid("loan_id")
        .references(() => loans.id, {
            onDelete: "cascade",
        })
        .notNull(),

    trancheNumber: integer("tranche_number")
        .notNull(),

    amount: money("amount")
        .notNull(),

    disbursementDate: date("disbursement_date"),

    remarks: text("remarks"),

    ...timestamps,

}, (table) => ({

    trancheLoanIdx: index("tranche_loan_idx")
        .on(table.loanId),

}));

/* ============================================================
   LOAN STATUS HISTORY
============================================================ */

export const loanStatusHistory = pgTable("loan_status_history", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanId: uuid("loan_id")
        .references(() => loans.id, {
            onDelete: "cascade",
        })
        .notNull(),

    fromStatus: loanStatusEnum("from_status"),

    toStatus: loanStatusEnum("to_status")
        .notNull(),

    changedBy: uuid("changed_by")
        .references(() => users.id),

    reason: text("reason"),

    changedAt: timestamp("changed_at", {
        withTimezone: true,
    }).defaultNow(),

}, (table) => ({

    statusHistoryLoanIdx: index("status_history_loan_idx")
        .on(table.loanId),

}));
