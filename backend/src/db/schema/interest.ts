import {
    pgTable,
    uuid,
    text,
    boolean,
    numeric,
    date,
    index,
} from "drizzle-orm/pg-core";

import { interestBasisEnum, timestamps } from "./shared";

import { loans } from "./loan";

/* ============================================================
   INTEREST CONFIGURATIONS

   The rates a loan's ledger accrues at, effective-dated. The Loan
   module writes a new revision whenever the loan's interest values
   change; a revision is never edited in place. The ledger resolves
   each month's revision by date and snapshots what it used onto the
   Journal rows it posts, so a later change never rewrites a posted
   month.

   This is the ONLY place a loan's interest rate and TDS rate are
   stored.
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

    /** Annual interest rate, %. */
    annualRate: numeric("annual_rate", {
        precision: 8,
        scale: 4,
    }).notNull(),

    /** TDS withheld as a percentage of accrued interest. */
    tdsRatePercent: numeric("tds_rate_percent", {
        precision: 5,
        scale: 2,
    }).notNull().default("10"),

    /** Day-count basis of the ledger's daily running-balance walk. */
    interestBasis: interestBasisEnum("interest_basis")
        .notNull(),

    effectiveFrom: date("effective_from")
        .notNull(),

    effectiveTo: date("effective_to"),

    isCurrent: boolean("is_current")
        .notNull()
        .default(true),

    remarks: text("remarks"),

    /* When true, the day-count becomes inclusive of both period endpoints
       (+1 day) instead of the default exclusive-of-one-endpoint count. */
    includeOpeningClosingDays: boolean("include_opening_closing_days")
        .notNull()
        .default(false),

    ...timestamps,

}, (table) => ({

    interestConfigLoanIdx: index("interest_config_loan_idx")
        .on(table.loanId),

    interestConfigCurrentIdx: index("interest_config_current_idx")
        .on(table.loanId, table.isCurrent),

}));
