import { readSheet } from "read-excel-file/browser";
import type { KpiLedgerRow, ParsedLedger } from "./types";

const HEADER_ALIASES: Record<string, keyof RawRow> = {
  date: "date",
  particulars: "particulars",
  "vch type": "vchType",
  "vch no.": "vchNo",
  "vch no": "vchNo",
  debit: "debit",
  credit: "credit",
  balance: "balance",
};

interface RawRow {
  date: unknown;
  particulars: unknown;
  vchType: unknown;
  vchNo: unknown;
  debit: unknown;
  credit: unknown;
  balance: unknown;
}

let nextId = 1;
function newId(): string {
  return `row-${nextId++}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The value exactly as the cell shows it, trimmed. Empty cell -> null. */
function toCellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = value instanceof Date ? value.toISOString() : String(value).trim();
  return text === "" ? null : text;
}

/**
 * Normalizes a date cell to DD-MMM-YYYY (e.g. "05-May-2025") — never an ISO
 * string with a "T…Z". A real Date cell, a "05-May-25" / "5-May-2025" text
 * cell, or a "05/05/2025" text cell are all recognized; anything else is left
 * exactly as written.
 */
function formatLedgerDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getDate()).padStart(2, "0")}-${MONTHS[value.getMonth()]}-${value.getFullYear()}`;
  }

  const text = toCellText(value);
  if (text === null) return null;

  // 05-May-25 / 5-May-2025 / 05 May 2025
  const named = text.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{2,4})$/);
  if (named) {
    const day = named[1].padStart(2, "0");
    const monIdx = MONTHS.findIndex((m) => m.toLowerCase() === named[2].slice(0, 3).toLowerCase());
    const year = named[3].length === 2 ? `20${named[3]}` : named[3];
    if (monIdx !== -1) return `${day}-${MONTHS[monIdx]}-${year}`;
  }

  // 05/05/2025 or 05-05-2025 (DD/MM/YYYY, the Indian ledger convention)
  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numeric) {
    const day = numeric[1].padStart(2, "0");
    const monIdx = Number(numeric[2]) - 1;
    const year = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3];
    if (monIdx >= 0 && monIdx < 12) return `${day}-${MONTHS[monIdx]}-${year}`;
  }

  // ISO from a Date that slipped through as text
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const monIdx = Number(iso[2]) - 1;
    if (monIdx >= 0 && monIdx < 12) return `${iso[3]}-${MONTHS[monIdx]}-${iso[1]}`;
  }

  return text;
}

/** Finds the header row by locating the row that contains a "Date" cell and a "Particulars" cell. */
function findHeaderRowIndex(grid: unknown[][]): number {
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i].map((c) => (c == null ? "" : String(c).trim().toLowerCase()));
    if (row.includes("date") && row.includes("particulars")) return i;
  }
  return -1;
}

/**
 * Parses a ledger workbook shaped like GAF.xlsx: a few preamble rows (report
 * title, the account holder's name and loan id, a date range), a header row,
 * then data rows where a "primary" row (has a Date or Vch No.) can be followed
 * by "continuation" rows that only carry extra narration in the Particulars
 * column — those are appended to the previous row.
 *
 * Nothing is dropped: every non-empty preamble row is captured into `meta`, and
 * every data row is kept. Only the Date column is reformatted (to DD-MMM-YYYY);
 * every other value is stored exactly as the cell shows it.
 */
export async function parseLedgerWorkbook(file: File): Promise<ParsedLedger> {
  const grid = (await readSheet(file)) as unknown[][];

  const headerIndex = findHeaderRowIndex(grid);
  if (headerIndex === -1) {
    throw new Error("Could not find a header row containing 'Date' and 'Particulars' columns.");
  }

  // Everything above the header row — the report title, account name, loan id,
  // date range. Each row's non-empty cells joined; rows joined with " / ".
  const meta =
    grid
      .slice(0, headerIndex)
      .map((r) => r.map((c) => toCellText(c)).filter((c): c is string => c !== null).join(" | "))
      .filter((line) => line !== "")
      .join("  /  ") || null;

  const headerCells = grid[headerIndex].map((c) => (c == null ? "" : String(c).trim().toLowerCase()));
  const colIndex: Partial<Record<keyof RawRow, number>> = {};
  headerCells.forEach((cell, idx) => {
    const key = HEADER_ALIASES[cell];
    if (key && colIndex[key] === undefined) colIndex[key] = idx;
  });

  const rows: KpiLedgerRow[] = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const raw = grid[i];
    if (!raw || raw.every((c) => toCellText(c) === null)) continue;

    const get = (key: keyof RawRow) => (colIndex[key] !== undefined ? raw[colIndex[key]!] : undefined);
    const date = formatLedgerDate(get("date"));
    const vchNo = toCellText(get("vchNo"));
    const particulars = toCellText(get("particulars"));

    const isPrimaryRow = date !== null || vchNo !== null;

    if (isPrimaryRow) {
      rows.push({
        id: newId(),
        date,
        particulars: particulars ?? "",
        vchType: toCellText(get("vchType")),
        vchNo,
        debit: toCellText(get("debit")),
        credit: toCellText(get("credit")),
        balance: toCellText(get("balance")),
      });
    } else if (rows.length > 0 && particulars !== null) {
      const last = rows[rows.length - 1];
      last.particulars = last.particulars ? `${last.particulars} — ${particulars}` : particulars;
    }
  }

  return { meta, rows };
}
