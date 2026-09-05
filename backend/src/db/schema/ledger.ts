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

import { ledgerVchTypeEnum, money, timestamps } from "./shared";
import { loans } from "./loan";

/* ============================================================
   LEDGER ENTRIES

   One row per Payment, Receipt, or (auto-generated) Journal
   Interest/TDS entry on a LOAN ACCOUNT's running account. The
   running Balance is never stored here — it's computed on read as
   a cumulative (debit - credit) walk, ordered by entryDate then
   sequenceNo. See modules/ledger/ledger.service.ts.

   The Interest/TDS rates this ledger accrues at are NOT stored
   here: they live on the loan row (loans.interestRate and
   loans.tdsRatePercent), which is their single source of truth.
   Each posted Journal row still keeps the rate it accrued at in
   `ratePercent`, so changing the loan's rate never rewrites history.
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
