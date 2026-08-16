import { readSheet } from "read-excel-file/browser";
import type { LedgerRow } from "./types";

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

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function toAmount(value: unknown): number | null {
  if (typeof value === "number") return value;
  const text = toText(value).replace(/,/g, "");
  if (text === "") return null;
  const num = Number.parseFloat(text);
  return Number.isNaN(num) ? null : num;
}

/** Splits a "<amount> Dr" / "<amount> Cr" cell into a signed number (Dr positive, Cr negative). */
function parseSignedBalance(value: unknown): number | null {
  if (typeof value === "number") return value;
  const text = toText(value);
  if (text === "") return null;
  const match = text.match(/^([\d,.]+)\s*(Dr|Cr)?$/i);
  if (!match) return toAmount(text);
  const amount = Number.parseFloat(match[1].replace(/,/g, ""));
  if (Number.isNaN(amount)) return null;
  return match[2]?.toLowerCase() === "cr" ? -amount : amount;
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = toText(value);
  if (text === "") return null;
  // Ledger dates look like "05-May-25" — not natively parseable by Date(), so parse manually.
  const match = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (!match) return text;
  const [, day, mon, yearRaw] = match;
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const monthNum = months[mon.toLowerCase()];
  if (!monthNum) return text;
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  return `${year}-${monthNum}-${day.padStart(2, "0")}`;
}

/** Finds the header row by locating the row that contains a "Date" cell followed by "Particulars". */
function findHeaderRowIndex(grid: unknown[][]): number {
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i].map((c) => toText(c).toLowerCase());
    if (row.includes("date") && row.includes("particulars")) return i;
  }
  return -1;
}

/**
 * Parses a ledger workbook shaped like GAF.csv: a few title rows, a header row, then data rows
 * where a "primary" row (has a Date or Vch No.) can be followed by one or more "continuation"
 * rows that only carry extra narration text in the Particulars column — those get appended to
 * the previous row instead of becoming their own row.
 *
 * NOTE: this is the piece slated to move server-side (POST to the future Python microservice) —
 * keep its signature (File in, LedgerRow[] out) stable so the caller doesn't need to change.
 */
export async function parseLedgerWorkbook(file: File): Promise<LedgerRow[]> {
  const grid = (await readSheet(file)) as unknown[][];

  const headerIndex = findHeaderRowIndex(grid);
  if (headerIndex === -1) {
    throw new Error("Could not find a header row containing 'Date' and 'Particulars' columns.");
  }

  const headerCells = grid[headerIndex].map((c) => toText(c).toLowerCase());
  const colIndex: Partial<Record<keyof RawRow, number>> = {};
  headerCells.forEach((cell, idx) => {
    const key = HEADER_ALIASES[cell];
    if (key && colIndex[key] === undefined) colIndex[key] = idx;
  });

  const rows: LedgerRow[] = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const raw = grid[i];
    if (!raw || raw.every((c) => toText(c) === "")) continue;

    const get = (key: keyof RawRow) => (colIndex[key] !== undefined ? raw[colIndex[key]!] : undefined);
    const date = toText(get("date"));
    const vchNo = toText(get("vchNo"));
    const particulars = toText(get("particulars"));

    const isPrimaryRow = date !== "" || vchNo !== "";

    if (isPrimaryRow) {
      rows.push({
        id: newId(),
        date: parseDate(get("date")),
        particulars,
        vchType: toText(get("vchType")) || null,
        vchNo: vchNo || null,
        debit: toAmount(get("debit")),
        credit: toAmount(get("credit")),
        balance: parseSignedBalance(get("balance")),
        parameters: [],
        output: null,
      });
    } else if (rows.length > 0 && particulars !== "") {
      const last = rows[rows.length - 1];
      last.particulars = last.particulars ? `${last.particulars} — ${particulars}` : particulars;
    }
  }

  return rows;
}
