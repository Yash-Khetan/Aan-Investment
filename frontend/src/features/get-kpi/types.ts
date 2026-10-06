/**
 * One stored row of a loan's imported history — every value the raw text the
 * sheet showed. Read-only: the record of what was imported.
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

export interface PaginatedKpiLedger {
  rows: KpiLedgerRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type ImportedKind = "PAYMENT" | "RECEIPT" | "JOURNAL_INTEREST" | "JOURNAL_TDS";

/** One sheet row as the server read it: what it becomes and whether it ties to the sheet's balance. */
export interface AnalyzedRow {
  index: number;
  entryDate: string | null;
  kind: ImportedKind | null;
  amount: number | null;
  narration: string;
  sourceVchType: string | null;
  sourceVchNo: string | null;
  sheetBalance: number | null;
  computedBalance: number;
  ties: boolean;
  problem: string | null;
}

/** What posting a sheet would do, and everything that stops it. */
export interface ImportPreview {
  rows: AnalyzedRow[];
  problems: Array<{ index: number; message: string }>;
  conflicts: string[];
  canPost: boolean;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
  lastInterestMonth: string | null;
  closingBalance: number;
  totals: { disbursed: number; received: number; interest: number; tds: number };
}

/** One posted import. */
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
  importedAt: string | null;
}

/** One sheet, as sent to preview or post. */
export interface ImportSheetPayload {
  fileName: string;
  sheetName: string;
  meta: string | null;
  rows: Array<{
    date: string | null;
    particulars: string;
    narration: string | null;
    drCr: string | null;
    vchType: string | null;
    vchNo: string | null;
    debit: string | null;
    credit: string | null;
    balance: string | null;
  }>;
}
