import {
    pgTable,
    uuid,
    varchar,
    text,
    date,
    numeric,
    boolean,
    timestamp,
    bigserial,
    integer,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { interestBasisEnum, ledgerEntrySourceEnum, ledgerVchTypeEnum, money, timestamps } from "./shared";
import { loans } from "./loan";
import { users } from "./auth";

/* ============================================================
   LEDGER IMPORTS

   One row per historical ledger sheet posted into a loan's ledger
   (the loan page's "Imported history" tab). Its entries carry its
   id, so removing an import removes exactly what it posted.

   The history cutoff is read from here, never stored on the loan:
   the ledger posts its own month-end interest only for months after
   the last imported Interest journal, and refuses manual entries
   dated on or before the last imported row.
============================================================ */

export const ledgerImports = pgTable("ledger_imports", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanId: uuid("loan_id")
        .references(() => loans.id, {
            onDelete: "cascade",
        })
        .notNull(),

    fileName: varchar("file_name", { length: 255 }),

    sheetName: varchar("sheet_name", { length: 255 }),

    /** Everything above the sheet's column header — title, account, period — verbatim. */
    meta: text("meta"),

    rowCount: integer("row_count").notNull(),

    firstEntryDate: date("first_entry_date").notNull(),

    lastEntryDate: date("last_entry_date").notNull(),

    /** First of the month of the last imported Interest journal. Null when the sheet has none. */
    lastInterestMonth: date("last_interest_month"),

    /** The sheet's balance after its last row; positive = Dr. */
    closingBalance: money("closing_balance").notNull(),

    importedBy: uuid("imported_by")
        .references(() => users.id),

    ...timestamps,

}, (table) => ({

    ledgerImportLoanIdx: index("ledger_import_loan_idx")
        .on(table.loanId),

}));

/* ============================================================
   LEDGER ENTRIES

   One row per Payment, Receipt, or (auto-generated) Journal
   Interest/TDS entry on a LOAN ACCOUNT's running account. The
   running Balance is never stored here — it's computed on read as
   a cumulative (debit - credit) walk, ordered by entryDate then
   sequenceNo. See modules/ledger/ledger.service.ts.

   This ledger owns NO configuration. The Interest/TDS rates and
   the day-count basis it accrues at are read from the loan's
   interest configuration — the interest_configs revision in effect
   for the month being accrued.

   It is the ONLY record of money moving on a loan: a disbursement
   is a PAYMENT row, a collection a RECEIPT row. Every figure the
   app shows about a loan's money is read off these rows.

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

    /** Who made the entry: a person on the Ledger tab, the ledger's own month-end, or an imported sheet. */
    source: ledgerEntrySourceEnum("source")
        .notNull()
        .default("MANUAL"),

    /** The import that posted this entry. Null unless source = IMPORT. */
    importId: uuid("import_id")
        .references(() => ledgerImports.id, {
            onDelete: "cascade",
        }),

    /** The voucher type and number as the imported sheet printed them, e.g. "Journal" / "91". */
    sourceVchType: varchar("source_vch_type", { length: 100 }),

    sourceVchNo: varchar("source_vch_no", { length: 100 }),

    /**
     * A Payment/Receipt dated after the day it was entered is SCHEDULED: shown
     * on the ledger, but counted in no figure until its date arrives (every
     * figure is computed as at today). This records when the audit trail logged
     * it becoming effective — null until then, and for entries that were never
     * scheduled.
     */
    effectiveLoggedAt: timestamp("effective_logged_at", { withTimezone: true }),

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

    /* The ledger posts each month's Interest/TDS pair once. Only its own
       pairs are held to that: an imported sheet may carry two Interest
       journals in a month (a part-month charge, then the rest). */
    ledgerAccrualMonthUniqueIdx: uniqueIndex("ledger_accrual_month_idx")
        .on(table.loanId, table.accrualMonth, table.vchType)
        .where(sql`${table.source} = 'SYSTEM'`),

    ledgerImportIdx: index("ledger_import_idx")
        .on(table.importId),

}));
