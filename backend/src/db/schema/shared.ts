import {
    pgEnum,
    numeric,
    timestamp,
} from "drizzle-orm/pg-core";

/* ============================================================
   LOAN STATUS
============================================================ */

export const loanStatusEnum = pgEnum("loan_status", [
    "PENDING",
    "OVERDUE",
    "CLOSED",
    "WRITTEN_OFF",
]);

/* ============================================================
   LOAN TYPES
============================================================ */

export const loanTypeEnum = pgEnum("loan_type", [
    "SECURED",
    "UNSECURED",
]);

/* ============================================================
   SECURITY TYPES
============================================================ */

export const securityTypeEnum = pgEnum("security_type", [
    "PROPERTY",
    "MORTGAGE",
    "HYPOTHECATION_OF_RECEIVABLES",
    "PERSONAL_GUARANTEE",
    "CORPORATE_GUARANTEE",
    "OTHERS",
    "NONE",
]);

/* ============================================================
   BORROWER CONSTITUTION
============================================================ */

export const constitutionEnum = pgEnum("constitution", [
    "INDIVIDUAL",
    "PROPRIETORSHIP",
    "PARTNERSHIP",
    "LLP",
    "PRIVATE_LIMITED",
    "PUBLIC_LIMITED",
    "TRUST",
    "HUF",
    "OTHER",
]);

/* ============================================================
   INTEREST BASIS
============================================================ */

export const interestBasisEnum = pgEnum("interest_basis", [
    "ACTUAL_365",
    "ACTUAL_360",
    "THIRTY_360",
    "MONTHLY",
    "FIXED_MONTHLY",
    "FULL_MONTH",
    "CUSTOM",
]);

/* ============================================================
   INTEREST RULE TYPE
============================================================ */

export const interestRuleTypeEnum = pgEnum("interest_rule_type", [
    "NORMAL",
    "STEP_UP",
    "STEP_DOWN",
    "EVENT_BASED",
    "CUSTOM",
]);

/* ============================================================
   PENAL INTEREST
============================================================ */

export const penalInterestTypeEnum = pgEnum("penal_interest_type", [
    "PERCENTAGE",
    "FIXED_AMOUNT",
]);

/* ============================================================
   PAYMENT STATUS
============================================================ */

export const paymentStatusEnum = pgEnum("payment_status", [
    "PENDING",
    "PARTIAL",
    "SUCCESS",
    "FAILED",
    "CANCELLED",
]);

/* ============================================================
   PAYMENT MODE
============================================================ */

export const paymentModeEnum = pgEnum("payment_mode", [
    "NEFT",
    "RTGS",
    "IMPS",
    "UPI",
    "CHEQUE",
    "CASH",
    "BANK_TRANSFER",
    "OTHER",
]);

/* ============================================================
   REPAYMENT TYPE
============================================================ */

export const repaymentTypeEnum = pgEnum("repayment_type", [
    "EMI",
    "BULLET",
    "INTEREST_ONLY",
    "STRUCTURED",
    "CUSTOM",
]);

/* ============================================================
   DOCUMENT TYPES
============================================================ */

export const documentTypeEnum = pgEnum("document_type", [
    "SANCTION_LETTER",
    "LOAN_AGREEMENT",
    "MORTGAGE_DEED",
    "HYPOTHECATION_DEED",
    "DPN",
    "BOARD_RESOLUTION",
    "PERSONAL_GUARANTEE",
    "CORPORATE_GUARANTEE",
    "LEGAL_OPINION",
    "VALUATION_REPORT",
    "INSURANCE",
    "KYC",
    "PAN_CARD",
    "GSTIN_CERTIFICATE",
    "AADHAAR",
    "FINANCIAL_STATEMENT",
    "OTHER",
]);

/* ============================================================
   DOCUMENT OWNER
============================================================ */

export const documentOwnerEnum = pgEnum("document_owner", [
    "BORROWER",
    "LOAN",
    "PROPERTY",
    "PROMOTER",
    "GUARANTOR",
]);

/* ============================================================
   REMINDER STATUS
============================================================ */

export const reminderStatusEnum = pgEnum("reminder_status", [
    "PENDING",
    "SENT",
    "FAILED",
]);

/* ============================================================
   REMINDER CHANNEL
============================================================ */

export const reminderChannelEnum = pgEnum("reminder_channel", [
    "EMAIL",
    "WHATSAPP",
    "SMS",
]);

/* ============================================================
   NOTIFICATION STATUS
============================================================ */

export const notificationStatusEnum = pgEnum("notification_status", [
    "SUCCESS",
    "FAILED",
]);

/* ============================================================
   COLLECTION STATUS
============================================================ */

export const collectionStatusEnum = pgEnum("collection_status", [
    "OPEN",
    "PROMISE_TO_PAY",
    "FOLLOW_UP",
    "CLOSED",
]);

/* ============================================================
   ACCOUNTING ENTRY TYPE
============================================================ */

export const accountingEntryTypeEnum = pgEnum("accounting_entry_type", [
    "DISBURSEMENT",
    "INTEREST_ACCRUAL",
    "INTEREST_RECEIPT",
    "PRINCIPAL_RECEIPT",
    "PENAL_INTEREST",
    "WRITE_OFF",
]);

/* ============================================================
   AUDIT ACTIONS
============================================================ */

export const auditActionEnum = pgEnum("audit_action", [
    "CREATE",
    "UPDATE",
    "DELETE",
    "LOGIN",
    "LOGOUT",
]);

/* ============================================================
   ENTITY STATUS
============================================================ */

export const entityStatusEnum = pgEnum("entity_status", [
    "ACTIVE",
    "INACTIVE",
]);

/* ============================================================
   COMMON MONEY COLUMN
============================================================ */

export const money = (name: string) =>
    numeric(name, {
        precision: 18,
        scale: 2,
    });

/* ============================================================
   COMMON TIMESTAMPS
============================================================ */

export const timestamps = {
    createdAt: timestamp("created_at", {
        withTimezone: true,
    }).defaultNow(),

    updatedAt: timestamp("updated_at", {
        withTimezone: true,
    }).defaultNow(),

    deletedAt: timestamp("deleted_at", {
        withTimezone: true,
    }),
};


/* ============================================================
   PENAL INTEREST BASE
============================================================ */

export const penalInterestBaseEnum = pgEnum("penal_interest_base", [
    "ENTIRE_OUTSTANDING",
    "OVERDUE_INSTALLMENT_ONLY",
]);


/* ============================================================
   PAYMENT WATERFALL BUCKET TYPE
============================================================ */

export const waterfallBucketTypeEnum = pgEnum("waterfall_bucket_type", [
    "PENALTY",
    "INTEREST",
    "PRINCIPAL",
    "SPECIFIC_TRANCHE",
]);