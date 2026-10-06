/**
 * Reading a client's historical ledger sheet — pure, no database.
 *
 * The browser sends the sheet's cells as text, exactly as the sheet shows
 * them. Everything that decides what a row means is worked out here, on the
 * server, so the preview a user checks and the entries that get posted come
 * from the same reading:
 *
 *   Payment   (debit)   → a disbursement            (PAYMENT)
 *   Receipt   (credit)  → money received             (RECEIPT)
 *   Journal   (debit)   → that month's interest      (JOURNAL_INTEREST)
 *   Journal   (credit)  → the TDS on it              (JOURNAL_TDS)
 *
 * Amounts are taken exactly as printed. Every row's running balance must
 * equal the Balance the sheet printed beside it; a sheet that does not tie
 * out is not posted.
 */

export type ImportedKind = "PAYMENT" | "RECEIPT" | "JOURNAL_INTEREST" | "JOURNAL_TDS";

/** One sheet row, every cell as the sheet shows it. */
export interface SheetRowInput {
  date: string | null;
  /** The account name in the Particulars column. */
  particulars: string;
  /** Narration lines printed under the row, joined. */
  narration?: string | null;
  /** The sheet's own Dr/Cr marker beside the particulars. */
  drCr?: string | null;
  vchType: string | null;
  vchNo: string | null;
  debit: string | null;
  credit: string | null;
  balance: string | null;
}

/** What a row becomes, with its running balance checked against the sheet's. */
export interface AnalyzedRow {
  /** Position in the sheet's rows, 0-based. */
  index: number;
  entryDate: string | null;
  kind: ImportedKind | null;
  amount: number | null;
  /** The ledger narration: particulars, then the narration lines. */
  narration: string;
  sourceVchType: string | null;
  sourceVchNo: string | null;
  /** The balance the sheet printed, Dr positive, Cr negative. Null when it printed none we could read. */
  sheetBalance: number | null;
  /** Debits less credits up to and including this row. */
  computedBalance: number;
  /** True when the computed balance equals the sheet's. */
  ties: boolean;
  /** Why this row cannot be posted, when it cannot. */
  problem: string | null;
}

export interface SheetAnalysis {
  rows: AnalyzedRow[];
  /** Every row that cannot be posted, in sheet order. Posting needs this empty. */
  problems: Array<{ index: number; message: string }>;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
  /** First of the month of the last Interest journal — where the ledger's own month-end posting takes over. */
  lastInterestMonth: string | null;
  closingBalance: number;
  totals: { disbursed: number; received: number; interest: number; tds: number };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** A balance-check difference at or below this is rounding, not a mismatch. */
const TIE_TOLERANCE = 0.005;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const pad = (n: number) => String(n).padStart(2, "0");

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * A sheet's date cell as YYYY-MM-DD. Reads "07-May-2025", "7-May-25",
 * "07 May 2025", "07/05/2025" (day first, the Indian convention) and
 * "2025-05-07". Null for anything else.
 */
export function parseSheetDate(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim();

  const named = t.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s,]*(\d{2,4})$/);
  if (named) {
    const d = Number(named[1]);
    const m = MONTHS.indexOf(named[2]!.slice(0, 3).toLowerCase()) + 1;
    const y = named[3]!.length === 2 ? 2000 + Number(named[3]) : Number(named[3]);
    return m > 0 && isRealDate(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
  }

  const numeric = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (numeric) {
    const d = Number(numeric[1]);
    const m = Number(numeric[2]);
    const y = numeric[3]!.length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    return isRealDate(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
  }

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return isRealDate(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
  }

  return null;
}

/**
 * An amount cell as a number: "1,00,000.00", "₹ 2000000", "2000000" all
 * read. Blank is null. A trailing Dr/Cr is ignored here — debit and credit
 * cells are already sided by their column.
 */
export function parseAmount(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const cleaned = text.replace(/₹|,|\s/g, "").replace(/(dr|cr)$/i, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * The sheet's Balance cell as a signed number: Dr (or no marker) positive, Cr
 * negative. A blank balance is zero — accounting software prints nothing
 * when an account stands at nil.
 */
export function parseBalance(text: string | null | undefined): number | null {
  if (text === null || text === undefined || text.trim() === "") return 0;
  const isCredit = /cr\s*$/i.test(text.trim());
  const amount = parseAmount(text);
  if (amount === null) return null;
  return isCredit ? -amount : amount;
}

/** First of the month of a YYYY-MM-DD date. */
export function monthOf(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/** What a row's voucher type and side make it, or why it cannot be posted. */
function classify(vchType: string | null, debit: number | null, credit: number | null): { kind: ImportedKind | null; amount: number | null; problem: string | null } {
  const type = (vchType ?? "").trim().toLowerCase();
  const hasDebit = debit !== null && debit !== 0;
  const hasCredit = credit !== null && credit !== 0;

  if (hasDebit && hasCredit) return { kind: null, amount: null, problem: "Has both a debit and a credit." };
  if (!hasDebit && !hasCredit) return { kind: null, amount: null, problem: "Has no amount." };
  if ((debit ?? 0) < 0 || (credit ?? 0) < 0) return { kind: null, amount: null, problem: "Has a negative amount." };

  switch (type) {
    case "payment":
      return hasDebit
        ? { kind: "PAYMENT", amount: debit, problem: null }
        : { kind: null, amount: null, problem: "A Payment on the credit side. Payments to the borrower are debits." };
    case "receipt":
      return hasCredit
        ? { kind: "RECEIPT", amount: credit, problem: null }
        : { kind: null, amount: null, problem: "A Receipt on the debit side. Money received is a credit." };
    case "journal":
      return hasDebit
        ? { kind: "JOURNAL_INTEREST", amount: debit, problem: null }
        : { kind: "JOURNAL_TDS", amount: credit, problem: null };
    default:
      return {
        kind: null,
        amount: null,
        problem: `Voucher type "${vchType ?? ""}" is not one the ledger records. Only Payment, Receipt and Journal rows can be imported.`,
      };
  }
}

/**
 * Reads a whole sheet: what each row becomes, whether its balance ties to the
 * sheet's, and everything that stops it being posted.
 *
 * Rows with no date and no amount are the sheet's own furniture (a totals
 * line) and are left out. An "Opening Balance" line is refused: the history
 * has to start from the loan's first entry for its balances to be rebuilt.
 */
export function analyzeSheet(input: SheetRowInput[]): SheetAnalysis {
  const rows: AnalyzedRow[] = [];
  const problems: SheetAnalysis["problems"] = [];
  const totals = { disbursed: 0, received: 0, interest: 0, tds: 0 };
  let running = 0;
  let previousDate: string | null = null;
  let lastInterestMonth: string | null = null;

  input.forEach((row, index) => {
    const debit = parseAmount(row.debit);
    const credit = parseAmount(row.credit);
    const entryDate = parseSheetDate(row.date);

    // A totals or blank line at the foot of the sheet: no date of its own.
    if (!row.date && !row.vchType && !row.vchNo) return;

    const narration = [row.particulars?.trim(), row.narration?.trim()].filter(Boolean).join(" — ");
    let problem: string | null = null;
    let kind: ImportedKind | null = null;
    let amount: number | null = null;

    if (/opening\s+balance/i.test(row.particulars ?? "")) {
      problem = "An opening balance line. Export the ledger from the loan's first entry so every balance can be rebuilt.";
    } else if (!entryDate) {
      problem = `"${row.date ?? ""}" is not a date that can be read.`;
    } else if (previousDate && entryDate < previousDate) {
      problem = "Dated before the row above it. The sheet must be in date order.";
    } else {
      ({ kind, amount, problem } = classify(row.vchType, debit, credit));
    }

    if (kind && amount !== null) {
      running = round2(running + (kind === "PAYMENT" || kind === "JOURNAL_INTEREST" ? amount : -amount));
      if (kind === "PAYMENT") totals.disbursed = round2(totals.disbursed + amount);
      if (kind === "RECEIPT") totals.received = round2(totals.received + amount);
      if (kind === "JOURNAL_INTEREST") {
        totals.interest = round2(totals.interest + amount);
        lastInterestMonth = monthOf(entryDate!);
      }
      if (kind === "JOURNAL_TDS") totals.tds = round2(totals.tds + amount);
    }

    const sheetBalance = parseBalance(row.balance);
    const ties = sheetBalance !== null && Math.abs(sheetBalance - running) <= TIE_TOLERANCE;
    if (!problem && sheetBalance === null) problem = `The balance "${row.balance ?? ""}" cannot be read.`;
    if (!problem && !ties) {
      problem = `The sheet's balance is ${sheetBalance}, but the rows up to here add up to ${running}.`;
    }

    if (entryDate) previousDate = entryDate;
    if (problem) problems.push({ index, message: problem });

    rows.push({
      index,
      entryDate,
      kind,
      amount,
      narration,
      sourceVchType: row.vchType,
      sourceVchNo: row.vchNo,
      sheetBalance,
      computedBalance: running,
      ties,
      problem,
    });
  });

  const dated = rows.filter((r) => r.entryDate !== null);
  if (dated.length === 0) problems.push({ index: -1, message: "The sheet has no rows to import." });

  return {
    rows,
    problems,
    firstEntryDate: dated[0]?.entryDate ?? null,
    lastEntryDate: dated[dated.length - 1]?.entryDate ?? null,
    lastInterestMonth,
    closingBalance: running,
    totals,
  };
}

/**
 * The first month the ledger posts its own month-end interest for: the month
 * of its first entry, or — when history has been imported — the month after
 * the last imported Interest journal, whichever is later. Imported months
 * keep the interest the sheet charged; the ledger never adds its own on top.
 */
export function firstSystemAccrualMonth(earliestEntryMonth: string, lastImportedInterestMonth: string | null): string {
  if (!lastImportedInterestMonth) return earliestEntryMonth;
  const [y, m] = lastImportedInterestMonth.split("-").map(Number);
  const next = m === 12 ? `${y! + 1}-01-01` : `${y}-${pad(m! + 1)}-01`;
  return next > earliestEntryMonth ? next : earliestEntryMonth;
}
