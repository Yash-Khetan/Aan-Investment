import {
    pgTable,
    uuid,
    varchar,
    text,
    date,
    numeric,
    index,
} from "drizzle-orm/pg-core";

import {
    securityTypeEnum,
    entityStatusEnum,
    money,
    timestamps,
} from "./shared";

import { loans } from "./loan";
import { borrowers } from "./borrower";

/* ============================================================
   COLLATERALS
============================================================ */

export const collaterals = pgTable("collaterals", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanId: uuid("loan_id")
        .references(() => loans.id, {
            onDelete: "cascade",
        })
        .notNull(),

    ownerId: uuid("owner_id")
        .references(() => borrowers.id),

    securityType: securityTypeEnum("security_type")
        .notNull(),

    description: text("description"),

    /* ── Property Details ── */

    propertyType: varchar("property_type", {
        length: 100,
    }),

    propertyAddress: text("property_address"),

    surveyNumber: varchar("survey_number", {
        length: 100,
    }),

    areaInSqFt: numeric("area_in_sq_ft", {
        precision: 12,
        scale: 2,
    }),

    /* ── Valuation ── */

    estimatedValue: money("estimated_value"),

    valuationDate: date("valuation_date"),

    valuationBy: varchar("valuation_by", {
        length: 255,
    }),

    /* ── Mortgage ── */

    mortgageType: varchar("mortgage_type", {
        length: 50,
    }),

    mortgageDate: date("mortgage_date"),

    mortgageDeedNumber: varchar("mortgage_deed_number", {
        length: 100,
    }),

    /* ── LTV ── */

    ltvRatio: numeric("ltv_ratio", {
        precision: 5,
        scale: 2,
    }),

    /* ── Status ── */

    status: entityStatusEnum("status")
        .default("ACTIVE"),

    remarks: text("remarks"),

    ...timestamps,

}, (table) => ({

    collateralLoanIdx: index("collateral_loan_idx")
        .on(table.loanId),

    collateralOwnerIdx: index("collateral_owner_idx")
        .on(table.ownerId),

}));

/* ============================================================
   COLLATERAL INSURANCE
============================================================ */

export const collateralInsurance = pgTable("collateral_insurance", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    collateralId: uuid("collateral_id")
        .references(() => collaterals.id, {
            onDelete: "cascade",
        })
        .notNull(),

    policyNumber: varchar("policy_number", {
        length: 100,
    }).notNull(),

    insurer: varchar("insurer", {
        length: 255,
    }),

    insuredAmount: money("insured_amount"),

    premiumAmount: money("premium_amount"),

    startDate: date("start_date"),

    expiryDate: date("expiry_date"),

    status: entityStatusEnum("status")
        .default("ACTIVE"),

    remarks: text("remarks"),

    ...timestamps,

}, (table) => ({

    insuranceCollateralIdx: index("insurance_collateral_idx")
        .on(table.collateralId),

    insuranceExpiryIdx: index("insurance_expiry_idx")
        .on(table.expiryDate),

}));

/* ============================================================
   CHARGE RECORDS (CERSAI / ROC)
============================================================ */

export const chargeRecords = pgTable("charge_records", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    collateralId: uuid("collateral_id")
        .references(() => collaterals.id, {
            onDelete: "cascade",
        })
        .notNull(),

    chargeType: varchar("charge_type", {
        length: 50,
    }).notNull(),

    registrationNumber: varchar("registration_number", {
        length: 100,
    }),

    registrationDate: date("registration_date"),

    satisfactionDate: date("satisfaction_date"),

    status: entityStatusEnum("status")
        .default("ACTIVE"),

    remarks: text("remarks"),

    ...timestamps,

}, (table) => ({

    chargeCollateralIdx: index("charge_collateral_idx")
        .on(table.collateralId),

}));
