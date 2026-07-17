import {
    pgTable,
    uuid,
    varchar,
    text,
    date,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import {
    paymentStatusEnum,
    paymentModeEnum,
    money,
    timestamps,
} from "./shared";

import { loans } from "./loan";
import { installments } from "./repayment";
import { users } from "./auth";

/* ============================================================
   PAYMENTS
============================================================ */

export const payments = pgTable("payments", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    paymentRefNumber: varchar("payment_ref_number", {
        length: 50,
    }).notNull(),

    loanId: uuid("loan_id")
        .references(() => loans.id)
        .notNull(),

    amount: money("amount")
        .notNull(),

    paymentDate: date("payment_date")
        .notNull(),

    valueDate: date("value_date"),

    paymentMode: paymentModeEnum("payment_mode")
        .notNull(),

    status: paymentStatusEnum("status")
        .default("PENDING"),

    transactionRef: varchar("transaction_ref", {
        length: 100,
    }),

    receivedBy: uuid("received_by")
        .references(() => users.id),

    remarks: text("remarks"),

    ...timestamps,

}, (table) => ({

    paymentRefIdx: uniqueIndex("payment_ref_idx")
        .on(table.paymentRefNumber),

    paymentLoanIdx: index("payment_loan_idx")
        .on(table.loanId),

    paymentDateIdx: index("payment_date_idx")
        .on(table.paymentDate),

    paymentStatusIdx: index("payment_status_idx")
        .on(table.status),

}));

/* ============================================================
   PAYMENT ALLOCATIONS
============================================================ */

export const paymentAllocations = pgTable("payment_allocations", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    paymentId: uuid("payment_id")
        .references(() => payments.id, {
            onDelete: "cascade",
        })
        .notNull(),

    installmentId: uuid("installment_id")
        .references(() => installments.id),

    principalApplied: money("principal_applied")
        .default("0"),

    interestApplied: money("interest_applied")
        .default("0"),

    penalInterestApplied: money("penal_interest_applied")
        .default("0"),

    otherCharges: money("other_charges")
        .default("0"),

    ...timestamps,

}, (table) => ({

    allocationPaymentIdx: index("allocation_payment_idx")
        .on(table.paymentId),

    allocationInstallmentIdx: index("allocation_installment_idx")
        .on(table.installmentId),

}));
