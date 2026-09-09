/**
 * One row as stored in kpi_ledger_rows and returned to the client. Every value
 * field is the raw text from the source sheet — see the schema comment.
 */
export interface KpiLedgerRow {
  id: string;
  rowIndex: number;
  date: string | null;
  particulars: string;
  vchType: string | null;
  vchNo: string | null;
  debit: string | null;
  credit: string | null;
  balance: string | null;
}

/** A row as it arrives from the browser parser / the "add entry" form — no DB id yet. */
export interface KpiLedgerRowInput {
  date?: string | null;
  particulars?: string;
  vchType?: string | null;
  vchNo?: string | null;
  debit?: string | null;
  credit?: string | null;
  balance?: string | null;
}

export interface AttachRowsInput {
  loanId: string;
  importedBy: string;
  rows: KpiLedgerRowInput[];
  sourceFileName?: string | null;
  sourceMeta?: string | null;
}

export interface AttachRowsResult {
  loanId: string;
  appended: number;
  totalRows: number;
}

export interface PaginatedKpiLedgerRows {
  rows: KpiLedgerRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
