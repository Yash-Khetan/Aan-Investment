import {
    pgTable,
    uuid,
    text,
    boolean,
    integer,
    date,
    index,
} from "drizzle-orm/pg-core";

import {
    paymentStatusEnum,
    money,
    timestamps,
} from "./shared";

import { loans } from "./loan";

/* ============================================================
   REPAYMENT SCHEDULES (Versioned)
============================================================ */

export const repaymentSchedules = pgTable("repayment_schedules", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanId: uuid("loan_id")
        .references(() => loans.id, {
            onDelete: "cascade",
        })
        .notNull(),

    version: integer("version")
        .default(1)
        .notNull(),

    isCurrent: boolean("is_current")
        .default(true),

    remarks: text("remarks"),

    ...timestamps,

}, (table) => ({

    schedLoanIdx: index("sched_loan_idx")
        .on(table.loanId),

    schedCurrentIdx: index("sched_current_idx")
        .on(table.loanId, table.isCurrent),

}));

/* ============================================================
   INSTALLMENTS
============================================================ */

export const installments = pgTable("installments", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    scheduleId: uuid("schedule_id")
        .references(() => repaymentSchedules.id, {
            onDelete: "cascade",
        })
        .notNull(),

    installmentNumber: integer("installment_number")
        .notNull(),

    dueDate: date("due_date")
        .notNull(),

    /* ── Expected Amounts ── */

    principalAmount: money("principal_amount")
        .default("0"),

    interestAmount: money("interest_amount")
        .default("0"),

    totalAmount: money("total_amount")
        .default("0"),

    /* ── Paid Amounts ── */

    paidPrincipal: money("paid_principal")
        .default("0"),

    paidInterest: money("paid_interest")
        .default("0"),

    paidTotal: money("paid_total")
        .default("0"),

    /* ── Status ── */

    status: paymentStatusEnum("status")
        .default("PENDING"),

    paidDate: date("paid_date"),

    ...timestamps,

}, (table) => ({

    installmentSchedIdx: index("installment_sched_idx")
        .on(table.scheduleId),

    installmentDueIdx: index("installment_due_idx")
        .on(table.dueDate),

    installmentStatusIdx: index("installment_status_idx")
        .on(table.status),

}));
