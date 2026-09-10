import {
    pgTable,
    uuid,
    varchar,
    text,
    integer,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import { timestamps } from "./shared";
import { loans } from "./loan";
import { users } from "./auth";

/* ============================================================
   KPI LEDGER ROWS

   Rows extracted, in the browser, from a client's historical
   ledger workbook (the "Get KPI" feature) and attached to a loan
   as that client's opening history. Deliberately a SEPARATE table
   from `ledger_entries` (modules/ledger): that table is the
   operational, interest-engine-owned Payment/Receipt/Journal
   ledger with a fixed vch_type enum and system-assigned vch_no.
   This table instead stores whatever the uploaded statement
   actually contained.

   Every value is stored EXACTLY as it appeared in the sheet — no
   normalization. `entry_date` keeps the source date text
   (e.g. "05-May-25"); `debit` / `credit` / `balance` are text, not
   numeric, so a cell like "1,000.00" or "5,000.00 Cr" round-trips
   unchanged.

   The feature is append-only: attaching another file adds rows
   after the existing ones (row_index continues from the current
   max), and rows are removed only by explicit soft delete
   (`deleted_at`). A loan's KPI history is never bulk-replaced.
============================================================ */

export const kpiLedgerRows = pgTable("kpi_ledger_rows", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    loanId: uuid("loan_id")
        .references(() => loans.id, {
            onDelete: "cascade",
        })
        .notNull(),

    /** Position within this loan's KPI history (0-based) — the stable sort key for pagination. */
    rowIndex: integer("row_index")
        .notNull(),

    /** Raw date cell text from the sheet, e.g. "05-May-25". Kept verbatim. */
    entryDate: text("entry_date"),

    particulars: text("particulars")
        .notNull()
        .default(""),

    vchType: varchar("vch_type", { length: 100 }),

    vchNo: varchar("vch_no", { length: 100 }),

    /** Raw sheet text, e.g. "1,000.00". Text (not numeric) so the cell round-trips unchanged. */
    debit: text("debit"),

    /** Raw sheet text, e.g. "1,000.00". */
    credit: text("credit"),

    /** Raw sheet text including any "Dr"/"Cr" suffix, e.g. "5,000.00 Cr". */
    balance: text("balance"),

    /** Original uploaded filename, denormalized onto every row of that import for quick display. */
    sourceFileName: varchar("source_file_name", { length: 255 }),

    /**
     * The preamble text from the uploaded sheet (report title, account holder
     * name, loan id, date range) — everything above the column header, kept
     * verbatim as provenance for the import.
     */
    sourceMeta: text("source_meta"),

    importedBy: uuid("imported_by")
        .references(() => users.id),

    ...timestamps,

}, (table) => ({

    kpiLedgerLoanIdx: index("kpi_ledger_loan_idx")
        .on(table.loanId),

    /** Row order within a loan's history must be unique — this is what pagination sorts by. */
    kpiLedgerLoanRowIdx: uniqueIndex("kpi_ledger_loan_row_idx")
        .on(table.loanId, table.rowIndex),

}));
