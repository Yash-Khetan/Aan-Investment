import {
    pgTable,
    uuid,
    varchar,
    text,
    date,
    integer,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import {
    assetClassificationEnum,
    cibilAccountStatusEnum,
    cibilCollateralTypeEnum,
    cibilCreditTypeEnum,
    loanStatusEnum,
    loanTypeEnum,
    paymentFrequencyEnum,
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

    /** Free-text label when securityType is OTHERS; unused otherwise. */
    otherSecurityType: varchar("other_security_type", {
        length: 255,
    }),

    repaymentType: repaymentTypeEnum("repayment_type")
        .notNull(),

    /* ── Amounts ──
       Only what was sanctioned. What has been disbursed, received and is
       outstanding is never stored on the loan: it is read off the loan's
       ledger (ledger_entries), the only record of money moving. The interest
       and TDS rates live in interest_configs, effective-dated. */

    sanctionedAmount: money("sanctioned_amount")
        .notNull(),

    /* ── Tenure ── */

    tenureMonths: integer("tenure_months")
        .notNull(),

    moratoriumMonths: integer("moratorium_months")
        .default(0),

    /* ── Key Dates ── */

    sanctionDate: date("sanction_date"),

    maturityDate: date("maturity_date"),

    /* ── Purpose & Remarks ── */

    purpose: text("purpose"),

    approvalNotes: text("approval_notes"),

    remarks: text("remarks"),

    /* ── Status ── */

    // The loan's lifecycle only. How overdue it is (SMA/NPA) is not a status
    // anyone sets: it is the DPD classification read off the ledger.
    status: loanStatusEnum("status")
        .default("ACTIVE"),

    /* ────────────────────────────────────────────────────────
       CIBIL reporting

       Kept alongside — not merged into — the operational
       columns above. `status` drives the app's own workflow,
       while `cibilAccountStatus` is what gets submitted; the
       same distinction applies to creditType vs loanType and
       paymentFrequency vs repaymentType.
    ──────────────────────────────────────────────────────── */

    /** CIBIL "CREDIT TYPE" (commercial) / "ACCOUNT TYPE" (consumer). */
    creditType: cibilCreditTypeEnum("credit_type"),

    /** CIBIL "Account STATUS". */
    cibilAccountStatus: cibilAccountStatusEnum("cibil_account_status"),

    /** CIBIL "ACCOUNT CLASSIFICATION" — asset/NPA staging. */
    assetClassification: assetClassificationEnum("asset_classification"),

    /** CIBIL "Payment Frequency" / "Repayment Frequency". */
    paymentFrequency: paymentFrequencyEnum("payment_frequency"),

    /** CIBIL "EMI Amount (If applicable)". */
    emiAmount: money("emi_amount"),

    /** CIBIL "Type of Collateral (If secured loan)". */
    collateralType: cibilCollateralTypeEnum("collateral_type"),

    /** CIBIL "Value of Collateral (If secured loan)". */
    collateralValue: money("collateral_value"),

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
