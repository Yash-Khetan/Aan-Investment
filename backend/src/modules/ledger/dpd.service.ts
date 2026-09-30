import { classifyByDpd } from "../loan/loan.metrics";
import { getEntriesForLoan, getLoanMaturityDate, type LedgerEntryRow } from "./ledger.repository";
import { syncMissingMonthEndJournals } from "./ledger.service";
import type { DpdGrid, DpdMonth, DpdYearRow } from "./ledger.types";

/**
 * Days Past Due for one loan, month by month, measured against the loan's
 * own ledger.
 *
 * The obligation each month is the Interest journal the ledger posts at
 * month-end, net of the TDS credit paired with it — the amount the borrower
 * actually has to remit. Receipts clear those obligations oldest-first, and
 * only interest is ever an obligation here, so a receipt reaches principal
 * only once every month's interest due so far has been settled.
 *
 * DPD counts a part-payment proportionally. Each overdue obligation owns the
 * days from its due date to the next obligation's due date (to the as-of
 * date, for the latest one), and contributes those days scaled by the share
 * of it still unpaid:
 *
 *     contribution = period days x remaining / net amount due
 *
 * A cleared obligation contributes nothing and an untouched one its whole
 * period. So dues of 1, 2 and 3 over 30-day periods, met by a receipt of 2,
 * clear the first, leave half the second (15 days) and all the third (30
 * days): 45 DPD, with 4 still overdue. With no part-payment the periods add
 * up to the age of the oldest uncleared obligation, the measure this
 * replaced.
 *
 * Every cell is computed as at its own month-end, from the entries dated on
 * or before it, so a Receipt posted in June cannot make March look current.
 * Nothing is stored. The ledger is the record, and it recomputes its own
 * month-end journals when a backdated entry lands, so any copy of the answer
 * taken earlier would silently drift from it.
 */

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function lastDayOfMonth(monthStart: Date): Date {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
}

function nextMonth(monthStart: Date): Date {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
}

/**
 * Whole days between two YYYY-MM-DD dates, positive when `to` is later.
 * Parsed as UTC midnight so no local timezone offset can shift a day count —
 * the same approach loan.metrics.ts uses for the loan-level figure.
 */
function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** One month's interest, net of its TDS, falling due on the day it was posted. */
interface DpdObligation {
  dueDate: string;
  netAmount: number;
}

/**
 * The obligations in a ledger, oldest first. Each Interest journal is paired
 * with its TDS journal by `pairedEntryId`; the TDS is deducted at source and
 * remitted by the borrower to the government rather than to us, so it is
 * settled the moment it is posted and only the net remains to be received.
 */
function toObligations(entries: LedgerEntryRow[]): DpdObligation[] {
  const tdsById = new Map<string, number>();
  for (const e of entries) {
    if (e.vchType === "JOURNAL_TDS") tdsById.set(e.id, Number(e.credit ?? 0));
  }

  const obligations: DpdObligation[] = [];
  for (const e of entries) {
    if (e.vchType !== "JOURNAL_INTEREST") continue;
    const tds = e.pairedEntryId ? (tdsById.get(e.pairedEntryId) ?? 0) : 0;
    const netAmount = round2(Number(e.debit ?? 0) - tds);
    if (netAmount <= 0) continue;
    obligations.push({ dueDate: e.entryDate, netAmount });
  }

  obligations.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

  // One obligation per due date, so each owns a distinct stretch of days.
  const merged: DpdObligation[] = [];
  for (const o of obligations) {
    const last = merged[merged.length - 1];
    if (last && last.dueDate === o.dueDate) last.netAmount = round2(last.netAmount + o.netAmount);
    else merged.push({ ...o });
  }
  return merged;
}

export interface DpdAsOf {
  dpdDays: number;
  classification: ReturnType<typeof classifyByDpd>;
  /** Unpaid remainder of the obligations past due, in rupees — the grid's Balance row. */
  amountOverdue: number;
  oldestOverdueDueDate: string | null;
}

/** An obligation after the pooled receipts have been appropriated to it. */
interface AppropriatedObligation extends DpdObligation {
  remaining: number;
}

/**
 * Tolerance below which a DPD figure is floating-point dust, not a real
 * fraction of a day (e.g. 15.000000000000002 from 30 x 0.7/1.4).
 */
const DPD_EPSILON = 1e-6;

/**
 * The loan's DPD as at `asOf`, from the entries dated on or before it.
 *
 * Every Receipt received by `asOf` goes into one pool that is applied to the
 * obligations oldest-first. A borrower who has remitted at least as much as
 * every month's net interest posted so far is current, whichever months the
 * individual receipts were labelled for. Disbursements (Payments) create no
 * obligation: in an interest-serviced loan the principal is not due until
 * maturity.
 *
 * Only obligations due before `asOf` are overdue. One falling due on `asOf`
 * itself has had no day in which to be paid, so it adds to neither the DPD
 * nor the Balance, though it still takes its turn at the pool.
 *
 * The proportional sum is rounded up to a whole day, so any overdue amount
 * left unpaid, however small, reads as at least 1 day past due.
 */
export function computeDpdAsOf(entries: LedgerEntryRow[], asOf: string): DpdAsOf {
  let pool = 0;
  for (const e of entries) {
    if (e.vchType === "RECEIPT" && e.entryDate <= asOf) pool = round2(pool + Number(e.credit ?? 0));
  }

  const appropriated: AppropriatedObligation[] = [];
  for (const obligation of toObligations(entries)) {
    if (obligation.dueDate > asOf) break;

    const applied = Math.min(pool, obligation.netAmount);
    pool = round2(pool - applied);

    // Round before comparing: money accumulated in floating point can land on
    // 124.60999999999 and leave a genuinely settled month "unpaid".
    const remaining = round2(obligation.netAmount - applied);
    appropriated.push({ ...obligation, remaining });
  }

  let oldestOverdueDueDate: string | null = null;
  let amountOverdue = 0;
  let proportionalDpd = 0;

  appropriated.forEach((obligation, i) => {
    if (obligation.remaining <= 0 || obligation.dueDate >= asOf) return;

    // Its period runs until the next obligation falls due; the latest one's runs to asOf.
    const periodEnd = appropriated[i + 1]?.dueDate ?? asOf;
    const periodDays = Math.max(daysBetween(obligation.dueDate, periodEnd), 0);
    proportionalDpd += periodDays * (obligation.remaining / obligation.netAmount);

    amountOverdue = round2(amountOverdue + obligation.remaining);
    if (oldestOverdueDueDate === null) oldestOverdueDueDate = obligation.dueDate;
  });

  const dpdDays = Math.max(Math.ceil(proportionalDpd - DPD_EPSILON), 0);

  return { dpdDays, classification: classifyByDpd(dpdDays), amountOverdue, oldestOverdueDueDate };
}

/**
 * The DPD History grid for one loan: one row per year of the loan's life,
 * one cell per month.
 *
 * The grid runs from the month of the loan's first ledger entry to the month
 * it matures — or to the current month, if it has run past maturity. Months
 * outside that span are not shown at all; months inside it that have not yet
 * arrived render as "X", as does any month before the first entry. Every
 * elapsed month is measured at its own month-end; the month in progress is
 * measured as at today and marked as such.
 */
export async function getDpdGrid(loanId: string): Promise<DpdGrid> {
  // Idempotent. The Ledger read does this too, but the two are fetched
  // side by side, and a month with no Interest journal has no obligation.
  await syncMissingMonthEndJournals(loanId);

  const maturityDate = await getLoanMaturityDate(loanId);
  const entries = await getEntriesForLoan(loanId);

  if (entries.length === 0) {
    return { loanId, years: [], current: null, worstDpd: 0 };
  }

  const today = new Date();
  const todayIso = toIsoDate(today);
  const currentMonth = firstOfMonth(today);
  const firstMonth = firstOfMonth(parseIsoDate(entries[0]!.entryDate));

  const maturityMonth = maturityDate ? firstOfMonth(parseIsoDate(maturityDate)) : currentMonth;
  const lastMonth = maturityMonth.getTime() > currentMonth.getTime() ? maturityMonth : currentMonth;

  const byMonth = new Map<string, DpdMonth>();
  for (let cursor = firstMonth; cursor.getTime() <= currentMonth.getTime(); cursor = nextMonth(cursor)) {
    const isCurrentMonth = cursor.getTime() === currentMonth.getTime();
    const asOf = isCurrentMonth ? todayIso : toIsoDate(lastDayOfMonth(cursor));
    const { dpdDays, classification, amountOverdue } = computeDpdAsOf(entries, asOf);
    byMonth.set(toIsoDate(cursor), { dpd: dpdDays, classification, amountOverdue, isCurrentMonth });
  }

  const years: DpdYearRow[] = [];
  for (let year = firstMonth.getFullYear(); year <= lastMonth.getFullYear(); year++) {
    years.push({
      year,
      months: Array.from({ length: 12 }, (_, i) => {
        const key = `${year}-${String(i + 1).padStart(2, "0")}-01`;
        return byMonth.get(key) ?? null;
      }),
    });
  }

  const current = computeDpdAsOf(entries, todayIso);

  return {
    loanId,
    years,
    current: {
      dpd: current.dpdDays,
      classification: current.classification,
      amountOverdue: current.amountOverdue,
      oldestOverdueDueDate: current.oldestOverdueDueDate,
    },
    worstDpd: [...byMonth.values()].reduce((max, m) => Math.max(max, m.dpd), 0),
  };
}
