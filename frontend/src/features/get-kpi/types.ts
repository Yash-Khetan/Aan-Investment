/**
 * One ledger row. Every value field is the raw text from the source Excel cell —
 * nothing is normalized, so `1,000.00` keeps its comma and `5,000.00 Cr` keeps
 * its suffix. `id` is the browser parser's "row-N" until the row is stored, then
 * the DB uuid.
 */
export interface KpiLedgerRow {
  id: string;
  date: string | null;
  particulars: string;
  vchType: string | null;
  vchNo: string | null;
  debit: string | null;
  credit: string | null;
  balance: string | null;
}

/** The editable subset of a row, as sent to the backend on attach / add / edit. */
export type KpiLedgerRowInput = Omit<KpiLedgerRow, "id">;

/** Result of parsing a workbook: the preamble text (report title, account name, loan id) plus the rows. */
export interface ParsedLedger {
  /** Every non-empty row above the header, joined — the client name and loan id live here. */
  meta: string | null;
  rows: KpiLedgerRow[];
}

export interface AttachRowsResult {
  loanId: string;
  appended: number;
  totalRows: number;
}

export interface PaginatedKpiLedger {
  rows: KpiLedgerRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
