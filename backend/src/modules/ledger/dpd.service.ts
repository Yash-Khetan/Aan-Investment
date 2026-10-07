import { getEntriesForLoan, getLoanMaturityDate } from "./ledger.repository";
import { syncMissingMonthEndJournals } from "./ledger.service";
import type { DpdGrid, DpdMonth, DpdYearRow } from "./ledger.types";
import { computeDpdAsOf } from "./dpd";

/**
 * The Ledger's month-by-month DPD History grid. The DPD figure itself is
 * computed in dpd.ts (pure); this module only reads the ledger and lays the
 * figure out month by month.
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
