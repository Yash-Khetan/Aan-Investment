import {
    pgTable,
    uuid,
    varchar,
    text,
    date,
    numeric,
    boolean,
    bigserial,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import { interestBasisEnum, ledgerVchTypeEnum, money, timestamps } from "./shared";
import { loans } from "./loan";

/* ============================================================
   LEDGER ENTRIES

   One row per Payment, Receipt, or (auto-generated) Journal
   Interest/TDS entry on a LOAN ACCOUNT's running account. The
   running Balance is never stored here — it's computed on read as
   a cumulative (debit - credit) walk, ordered by entryDate then
   sequenceNo. See modules/ledger/ledger.service.ts.

   This ledger owns NO configuration. The Interest/TDS rates and
   the day-count basis it accrues at are read from the Loan module
   and its interest configuration (loans.interestRate /
   loans.tdsRatePercent, and the interest_configs revision in
   effect for the month being accrued).

   What each posted Journal row DOES keep is a snapshot of the
   configuration it was actually calculated under — `ratePercent`,
   `interestBasis` and `includeOpeningClosingDays`. Recomputes read
   those back off the row, so changing the loan's configuration
   never rewrites an already-posted month.
============================================================ */

export const ledgerEntries = pgTable("ledger_entries", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanId: uuid("loan_id")
        .references(() => loans.id, {
            onDelete: "cascade",
        })
        .notNull(),

    entryDate: date("entry_date")
        .notNull(),

    narration: text("narration"),

    vchType: ledgerVchTypeEnum("vch_type")
        .notNull(),

    /** System-assigned, plain incrementing integer shared across all vch types per loan. */
    vchNo: varchar("vch_no", { length: 30 })
        .notNull(),

    /** Populated for PAYMENT and JOURNAL_INTEREST rows (increases balance). */
    debit: money("debit"),

    /** Populated for RECEIPT and JOURNAL_TDS rows (decreases balance). */
    credit: money("credit"),

    /**
     * Links a JOURNAL_INTEREST row to its paired JOURNAL_TDS row (and back),
     * so editing either one's rate can recompute both together. Null for
     * PAYMENT/RECEIPT.
     */
    pairedEntryId: uuid("paired_entry_id"),

    /**
     * First-of-month date this Journal pair accrues for. Null for
     * PAYMENT/RECEIPT. Unique per (loan, month, vchType) — this is what
     * makes the month-end auto-generator idempotent.
     */
    accrualMonth: date("accrual_month"),

    /**
     * Rate actually used for this entry (annual % for JOURNAL_INTEREST, % of
     * interest for JOURNAL_TDS) — independently editable per row. Null for
     * PAYMENT/RECEIPT.
     */
    ratePercent: numeric("rate_percent", { precision: 5, scale: 2 }),

    /**
     * Day-count basis this entry was accrued under, snapshotted from the
     * interest configuration in effect for its accrual month. Null for
     * PAYMENT/RECEIPT, and for Journal rows posted before this column
     * existed — those fall back to the ledger's historical default,
     * ACTUAL_365, so their amounts are reproduced unchanged.
     */
    interestBasis: interestBasisEnum("interest_basis"),

    /**
     * Day-count inclusivity this entry was accrued under, snapshotted with
     * `interestBasis` above. Null carries the same meaning: the historical
     * default, false.
     */
    includeOpeningClosingDays: boolean("include_opening_closing_days"),

    /** True only for the two auto-generated Journal rows. */
    isSystemGenerated: boolean("is_system_generated")
        .notNull()
        .default(false),

    /** Stable same-day ordering (e.g. Journal Interest must sort before its paired TDS row). */
    sequenceNo: bigserial("sequence_no", { mode: "number" })
        .notNull(),

    ...timestamps,

}, (table) => ({

    ledgerLoanIdx: index("ledger_loan_idx")
        .on(table.loanId),

    ledgerLoanDateIdx: index("ledger_loan_date_idx")
        .on(table.loanId, table.entryDate),

    ledgerVchNoUniqueIdx: uniqueIndex("ledger_vch_no_idx")
        .on(table.loanId, table.vchNo),

    ledgerAccrualMonthUniqueIdx: uniqueIndex("ledger_accrual_month_idx")
        .on(table.loanId, table.accrualMonth, table.vchType),

}));
