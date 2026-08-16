import {
    pgTable,
    uuid,
    varchar,
    text,
    boolean,
    integer,
    numeric,
    date,
    index,
} from "drizzle-orm/pg-core";

import {
    interestBasisEnum,
    interestRuleTypeEnum,
    penalInterestTypeEnum,
    penalInterestBaseEnum,
    calculationMethodEnum,
    money,
    timestamps,
} from "./shared";

import { loans } from "./loan";

/* ============================================================
   INTEREST CONFIGURATIONS
============================================================ */

export const interestConfigs = pgTable("interest_configs", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanId: uuid("loan_id")
        .references(() => loans.id, {
            onDelete: "cascade",
        })
        .notNull(),

    annualRate: numeric("annual_rate", {
        precision: 8,
        scale: 4,
    }).notNull(),

    interestBasis: interestBasisEnum("interest_basis")
        .notNull(),

    ruleType: interestRuleTypeEnum("rule_type")
        .default("NORMAL"),

    effectiveFrom: date("effective_from")
        .notNull(),

    effectiveTo: date("effective_to"),

    isCurrent: boolean("is_current")
        .default(true),

    remarks: text("remarks"),

    /* Only populated when interestBasis = CUSTOM. Evaluated safely via
       mathjs, not raw eval — see modules/interest/strategies/custom.strategy.ts */
    customFormula: text("custom_formula"),

    /* When true, day-count for every days-based basis (ACTUAL_365, ACTUAL_360,
       MONTHLY_RATE_ACTUAL_30) becomes inclusive of both period endpoints (+1
       day) instead of the default exclusive-of-one-endpoint count. */
    includeOpeningClosingDays: boolean("include_opening_closing_days")
        .default(false),

    /* RUNNING_BALANCE walks the loan's principal ledger (tranches +
       repayments) day by day; SIMPLE_INTEREST always uses the loan's
       original principal as a single point-in-time base. See
       modules/interest/interest.service.ts. */
    calculationMethod: calculationMethodEnum("calculation_method")
        .default("SIMPLE_INTEREST"),

    ...timestamps,

}, (table) => ({

    interestConfigLoanIdx: index("interest_config_loan_idx")
        .on(table.loanId),

    interestConfigCurrentIdx: index("interest_config_current_idx")
        .on(table.loanId, table.isCurrent),

}));

/* ============================================================
   INTEREST RULES (Step-Up / Step-Down / Event-Based)
============================================================ */

export const interestRules = pgTable("interest_rules", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    interestConfigId: uuid("interest_config_id")
        .references(() => interestConfigs.id, {
            onDelete: "cascade",
        })
        .notNull(),

    fromMonth: integer("from_month"),

    toMonth: integer("to_month"),

    rate: numeric("rate", {
        precision: 8,
        scale: 4,
    }).notNull(),

    triggerEvent: varchar("trigger_event", {
        length: 255,
    }),

    remarks: text("remarks"),

    ...timestamps,

}, (table) => ({

    interestRuleConfigIdx: index("interest_rule_config_idx")
        .on(table.interestConfigId),

}));

/* ============================================================
   PENAL INTEREST RULES
============================================================ */

export const penalInterestRules = pgTable("penal_interest_rules", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanId: uuid("loan_id")
        .references(() => loans.id, {
            onDelete: "cascade",
        })
        .notNull(),

    penalType: penalInterestTypeEnum("penal_type")
        .notNull(),

    penalRate: numeric("penal_rate", {
        precision: 8,
        scale: 4,
    }),

    penalAmount: money("penal_amount"),

    penalBase: penalInterestBaseEnum("penal_base")
        .default("OVERDUE_INSTALLMENT_ONLY"),

    gracePeriodDays: integer("grace_period_days")
        .default(0),

    isCurrent: boolean("is_current")
        .default(true),

    remarks: text("remarks"),

    ...timestamps,

}, (table) => ({

    penalRuleLoanIdx: index("penal_rule_loan_idx")
        .on(table.loanId),

}));
