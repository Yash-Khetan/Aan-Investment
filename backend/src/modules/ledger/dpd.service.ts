import {
  getAllocations,
  getDpdHistory,
  getLoanStartDate,
  getObligations,
  insertDpdMonths,
  type DpdAllocation,
  type DpdObligation,
} from "./dpd.repository";
import type { DpdGrid, DpdMonth, DpdYearRow } from "./ledger.types";

/**
 * Days Past Due for one loan, as a month-by-month history.
 *
 * DPD is measured against the loan's payment OBLIGATIONS (its current
 * repayment schedule's installments), not against the ledger's own rows —
 * the ledger records money movements, the schedule records what was owed and
 * when. A receipt existing is never enough to clear DPD on its own: an
 * obligation counts as cleared only once the payments appropriated to it add
 * up to the full amount due, which is why this reads dated
 * `payment_allocations` rather than the installment's mutable paid* columns.
 *
 * Nothing here changes any existing calculation. It reads obligations and
 * appropriations that other modules already produce, and derives a day count
 * from them.
 */

/** A whole 30-day period past due. Bucket 0 is "late, but under a month". */
const DAYS_PER_BUCKET = 30;

/** Months outside the loan's life — before it started, or not yet elapsed. */
export const NO_DATA = "X";

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

function lastDayOfMonth(monthStart: Date): Date {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Whole days between two YYYY-MM-DD dates, positive when `to` is later.
 * Parsed as UTC midnight so no local timezone offset can shift a day count -
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

export function bucketOf(dpdDays: number): number {
  return dpdDays <= 0 ? 0 : Math.floor(dpdDays / DAYS_PER_BUCKET);
}

export interface DpdAsOf {
  dpdDays: number;
  bucket: number;
  amountOverdue: number;
  oldestOverdueDueDate: string | null;
}

/**
 * The loan's DPD as at `asOf`, reconstructed rather than read off current
 * state — this is what makes back-filling historical months accurate. An
 * obligation is treated as cleared only by appropriations that had actually
 * arrived by `asOf`, so a payment made in June cannot retroactively make
 * March look current.
 *
 * DPD is the age of the OLDEST obligation still uncleared, matching the
 * basis `loan.metrics.ts` already uses for the loan-level figure. A partly
 * paid obligation is not cleared, so partial payment does not reduce DPD.
 */
export function computeDpdAsOf(
  obligations: DpdObligation[],
  allocations: DpdAllocation[],
  asOf: string
): DpdAsOf {
  const clearedByAsOf = new Map<string, number>();
  for (const alloc of allocations) {
    if (alloc.paymentDate > asOf) continue;
    clearedByAsOf.set(alloc.installmentId, (clearedByAsOf.get(alloc.installmentId) ?? 0) + alloc.amount);
  }

  let oldestOverdueDueDate: string | null = null;
  let amountOverdue = 0;

  for (const obligation of obligations) {
    if (obligation.dueDate > asOf) continue;

    // Round before comparing: money accumulated in floating point can land on
    // 926.34999999999997 and leave a genuinely settled obligation "unpaid".
    const cleared = round2(clearedByAsOf.get(obligation.installmentId) ?? 0);
    const shortfall = round2(obligation.totalAmount - cleared);
    if (shortfall <= 0) continue;

    amountOverdue = round2(amountOverdue + shortfall);
    if (oldestOverdueDueDate === null || obligation.dueDate < oldestOverdueDueDate) {
      oldestOverdueDueDate = obligation.dueDate;
    }
  }

  const dpdDays = oldestOverdueDueDate ? Math.max(daysBetween(oldestOverdueDueDate, asOf), 0) : 0;

  return { dpdDays, bucket: bucketOf(dpdDays), amountOverdue, oldestOverdueDueDate };
}

/**
 * Freezes a DPD row for every fully-elapsed month the loan has lived through
 * that isn't on record yet, oldest first.
 *
 * Deliberately mirrors `syncMissingMonthEndJournals`: walk from the loan's
 * start to the last fully-elapsed month, skip what already exists, write what
 * doesn't, and never touch a month already written. The current month is
 * never frozen — it isn't over, so its DPD is still moving.
 *
 * Silent on failure. A loan with no schedule yet simply has no obligations,
 * which is a legitimate 0-DPD history, not an error.
 */
export async function syncDpdHistory(loanId: string): Promise<void> {
  try {
    const startDate = await getLoanStartDate(loanId);
    if (!startDate) return;

    const existing = new Set((await getDpdHistory(loanId)).map((r) => r.monthStart));

    const obligations = await getObligations(loanId);
    const allocations = await getAllocations(obligations.map((o) => o.installmentId));

    const today = new Date();
    const lastElapsedMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    const pending: Parameters<typeof insertDpdMonths>[0] = [];
    let cursor = firstOfMonth(parseIsoDate(startDate));

    while (cursor.getTime() <= lastElapsedMonthStart.getTime()) {
      const monthStart = toIsoDate(cursor);
      if (!existing.has(monthStart)) {
        const asOf = toIsoDate(lastDayOfMonth(cursor));
        const { dpdDays, bucket, amountOverdue, oldestOverdueDueDate } = computeDpdAsOf(
          obligations,
          allocations,
          asOf
        );
        pending.push({ loanId, monthStart, dpdDays, bucket, amountOverdue, oldestOverdueDueDate });
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    await insertDpdMonths(pending);
  } catch {
    // No loan dates or no schedule yet — nothing to record until there is.
  }
}

/**
 * The DPD History grid for one loan: one row per year, one cell per month,
 * plus the live figure for the month in progress.
 *
 * Months before the loan started and months that haven't happened yet render
 * as "X" rather than 0 — no obligation existed, which is different from an
 * obligation met on time.
 */
export async function getDpdGrid(loanId: string): Promise<DpdGrid> {
  await syncDpdHistory(loanId);

  const startDate = await getLoanStartDate(loanId);
  const frozen = await getDpdHistory(loanId);

  const byMonth = new Map<string, DpdMonth>();
  for (const row of frozen) {
    byMonth.set(row.monthStart, {
      dpd: row.dpdDays,
      bucket: row.bucket,
      amountOverdue: Number(row.amountOverdue ?? 0),
      isCurrentMonth: false,
    });
  }

  // The month in progress is derived, never stored — it is still moving.
  const today = new Date();
  const currentMonthStart = toIsoDate(firstOfMonth(today));
  let current: DpdAsOf | null = null;

  if (startDate) {
    const obligations = await getObligations(loanId);
    const allocations = await getAllocations(obligations.map((o) => o.installmentId));
    current = computeDpdAsOf(obligations, allocations, toIsoDate(today));

    if (firstOfMonth(parseIsoDate(startDate)).getTime() <= firstOfMonth(today).getTime()) {
      byMonth.set(currentMonthStart, {
        dpd: current.dpdDays,
        bucket: current.bucket,
        amountOverdue: current.amountOverdue,
        isCurrentMonth: true,
      });
    }
  }

  const months = [...byMonth.keys()].sort();
  const years: DpdYearRow[] = [];

  if (months.length > 0) {
    const firstYear = Number(months[0]!.slice(0, 4));
    const lastYear = Number(months[months.length - 1]!.slice(0, 4));

    for (let year = firstYear; year <= lastYear; year++) {
      years.push({
        year,
        months: Array.from({ length: 12 }, (_, i) => {
          const key = `${year}-${String(i + 1).padStart(2, "0")}-01`;
          return byMonth.get(key) ?? null;
        }),
      });
    }
  }

  return {
    loanId,
    years,
    current: current
      ? {
          dpd: current.dpdDays,
          bucket: current.bucket,
          amountOverdue: current.amountOverdue,
          oldestOverdueDueDate: current.oldestOverdueDueDate,
        }
      : null,
    worstDpd: years.reduce(
      (max, y) => Math.max(max, ...y.months.map((m) => m?.dpd ?? 0)),
      0
    ),
  };
}
