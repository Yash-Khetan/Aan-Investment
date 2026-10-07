import readXlsxFile from "read-excel-file/browser";

/**
 * Reads a client's ledger workbook as exported from their accounting software
 * (the Tally "Ledger Account" layout): a few preamble lines (company, the
 * account and its loan number, the period), a header row, then one row per
 * voucher, each optionally followed by narration lines.
 *
 * Every sheet in the workbook is read. Columns are found by their header
 * names, not their position, so any export in this layout reads the same way.
 * Cells are passed on as the text the sheet shows — the server decides what
 * each row means, so the preview and the posting can never disagree.
 */

export interface SheetRow {
  /** Local key for lists; never sent. */
  id: string;
  date: string | null;
  /** The account named in the Particulars column. */
  particulars: string;
  /** Narration lines printed under the row, joined. */
  narration: string | null;
  /** The Dr/Cr marker printed beside the particulars. */
  drCr: string | null;
  vchType: string | null;
  vchNo: string | null;
  debit: string | null;
  credit: string | null;
  balance: string | null;
}

export interface ParsedSheet {
  name: string;
  /** Everything above the header row — company, account, loan number, period — lines joined with " / ". */
  meta: string | null;
  rows: SheetRow[];
}

type Column = "date" | "particulars" | "vchType" | "vchNo" | "debit" | "credit" | "balance";

const HEADERS: Record<string, Column> = {
  date: "date",
  particulars: "particulars",
  "vch type": "vchType",
  "voucher type": "vchType",
  "vch no.": "vchNo",
  "vch no": "vchNo",
  "voucher no.": "vchNo",
  "voucher no": "vchNo",
  debit: "debit",
  credit: "credit",
  balance: "balance",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let nextId = 1;

/** A cell as the sheet shows it, trimmed; empty is null. Dates as DD-Mon-YYYY. Whole numbers without ".0". */
function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${String(value.getDate()).padStart(2, "0")}-${MONTHS[value.getMonth()]}-${value.getFullYear()}`;
  }
  const text = String(value).trim();
  return text === "" ? null : text;
}

const isDrCr = (text: string | null) => text !== null && /^(dr|cr)$/i.test(text);

/** One sheet's grid of cells, read as a ledger. Exported for checking against real workbooks. */
export function parseSheet(name: string, grid: unknown[][]): ParsedSheet | null {
  const headerIndex = grid.findIndex((row) => {
    const cells = row.map((c) => String(c ?? "").trim().toLowerCase());
    return cells.includes("date") && cells.includes("particulars");
  });
  if (headerIndex === -1) return null;

  const meta =
    grid
      .slice(0, headerIndex)
      .map((r) => r.map(cellText).filter((c): c is string => c !== null).join(" | "))
      .filter((line) => line !== "")
      .join("  /  ") || null;

  const header = grid[headerIndex]!.map((c) => String(c ?? "").trim().toLowerCase());
  const col: Partial<Record<Column, number>> = {};
  header.forEach((cell, i) => {
    const key = HEADERS[cell];
    if (key && col[key] === undefined) col[key] = i;
  });

  // Particulars is often a merged heading over several columns (the Dr/Cr
  // marker, the account, spare columns): read every column from it up to the
  // next named column.
  const particularsStart = col.particulars ?? 1;
  const nextNamed = Object.values(col)
    .filter((i): i is number => i !== undefined && i > particularsStart)
    .sort((a, b) => a - b)[0];
  const particularsEnd = nextNamed ?? particularsStart + 1;

  const get = (row: unknown[], key: Column) => (col[key] !== undefined ? cellText(row[col[key]!]) : null);

  const rows: SheetRow[] = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    if (row.every((c) => cellText(c) === null)) continue;

    const parts = row.slice(particularsStart, particularsEnd).map(cellText).filter((c): c is string => c !== null);
    const drCr = parts.find(isDrCr) ?? null;
    const words = parts.filter((p) => !isDrCr(p)).join(" ");

    const date = get(row, "date");
    const vchType = get(row, "vchType");
    const vchNo = get(row, "vchNo");
    const debit = get(row, "debit");
    const credit = get(row, "credit");
    const balance = get(row, "balance");

    const isVoucher = date !== null || vchType !== null || vchNo !== null;
    const hasAmounts = debit !== null || credit !== null || balance !== null;

    if (isVoucher || hasAmounts) {
      // A voucher row — or a dateless line carrying amounts (the sheet's
      // totals), which is kept so nothing in the sheet is silently dropped.
      rows.push({ id: `row-${nextId++}`, date, particulars: words, narration: null, drCr, vchType, vchNo, debit, credit, balance });
    } else if (words && rows.length > 0) {
      // A narration line under the voucher above it.
      const last = rows[rows.length - 1]!;
      last.narration = last.narration ? `${last.narration} ${words}` : words;
    }
  }

  return { name, meta, rows };
}

/** Every sheet in the workbook that has a ledger header row. Throws when none do. */
export async function parseLedgerWorkbook(file: File): Promise<ParsedSheet[]> {
  const sheets = await readXlsxFile(file);
  const parsed = sheets
    .map((s) => parseSheet(s.sheet, s.data as unknown[][]))
    .filter((s): s is ParsedSheet => s !== null && s.rows.length > 0);

  if (parsed.length === 0) {
    throw new Error("No sheet in this file has a header row with Date and Particulars columns.");
  }
  return parsed;
}
