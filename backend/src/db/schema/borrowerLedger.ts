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
import { borrowers } from "./borrower";

/* ============================================================
   BORROWER LEDGER ENTRIES

   One row per Payment, Receipt, or (auto-generated) Journal
   Interest/TDS entry on a borrower's running account. The running
   Balance is never stored here — it's computed on read as a
   cumulative (debit - credit) walk, ordered by entryDate then
   sequenceNo. See modules/borrower-ledger/borrowerLedger.service.ts.
============================================================ */

export const borrowerLedgerEntries = pgTable("borrower_ledger_entries", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    borrowerId: uuid("borrower_id")
        .references(() => borrowers.id, {
            onDelete: "cascade",
        })
        .notNull(),

    entryDate: date("entry_date")
        .notNull(),

    narration: text("narration"),

    vchType: ledgerVchTypeEnum("vch_type")
        .notNull(),

    /** System-assigned, plain incrementing integer shared across all vch types per borrower. */
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
     * PAYMENT/RECEIPT. Unique per (borrower, month, vchType) — this is what
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

    ledgerBorrowerIdx: index("borrower_ledger_borrower_idx")
        .on(table.borrowerId),

    ledgerBorrowerDateIdx: index("borrower_ledger_borrower_date_idx")
        .on(table.borrowerId, table.entryDate),

    ledgerVchNoUniqueIdx: uniqueIndex("borrower_ledger_vch_no_idx")
        .on(table.borrowerId, table.vchNo),

    ledgerAccrualMonthUniqueIdx: uniqueIndex("borrower_ledger_accrual_month_idx")
        .on(table.borrowerId, table.accrualMonth, table.vchType),

}));

/* ============================================================
   BORROWER LEDGER SETTINGS

   One row per borrower holding the default Interest/TDS rate the
   silent month-end auto-generator uses. Editable anytime from the
   Borrower Ledger page; defaults to 21% / 10%.
============================================================ */

export const borrowerLedgerSettings = pgTable("borrower_ledger_settings", {

    borrowerId: uuid("borrower_id")
        .references(() => borrowers.id, {
            onDelete: "cascade",
        })
        .primaryKey(),

    defaultInterestRatePercent: numeric("default_interest_rate_percent", {
        precision: 5,
        scale: 2,
    }).notNull().default("21"),

    defaultTdsRatePercent: numeric("default_tds_rate_percent", {
        precision: 5,
        scale: 2,
    }).notNull().default("10"),

    ...timestamps,

});
