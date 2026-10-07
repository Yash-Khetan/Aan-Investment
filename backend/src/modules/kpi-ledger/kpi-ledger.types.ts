import type { z } from "zod";
import type { importSheetSchema } from "./kpi-ledger.validators";
import type { SheetAnalysis } from "./sheet";

/**
 * One row of an imported sheet as stored in kpi_ledger_rows — every value the
 * raw text the sheet showed. Read-only: the record of what was imported.
 */
export interface KpiLedgerRow {
  id: string;
  rowIndex: number;
  importId: string | null;
  sheetName: string | null;
  date: string | null;
  particulars: string;
  drCr: string | null;
  vchType: string | null;
  vchNo: string | null;
  debit: string | null;
  credit: string | null;
  balance: string | null;
}

export interface PaginatedKpiLedgerRows {
  rows: KpiLedgerRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type ImportSheetInput = z.infer<typeof importSheetSchema>;

/** What posting a sheet would do, and everything that stops it. */
export interface ImportPreview extends SheetAnalysis {
  /** Existing ledger entries the sheet would clash with. Posting needs this empty. */
  conflicts: string[];
  canPost: boolean;
}

/** One posted import, as listed on the loan's Imported history tab. */
export interface LedgerImportSummary {
  id: string;
  fileName: string | null;
  sheetName: string | null;
  meta: string | null;
  rowCount: number;
  firstEntryDate: string;
  lastEntryDate: string;
  lastInterestMonth: string | null;
  closingBalance: string;
  importedByName: string | null;
  importedAt: Date | null;
}
