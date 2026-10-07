import type { LedgerEntryRow } from "./ledger.repository";
import { allocateLedger } from "./allocation";

/**
 * Days Past Due for one loan as at a date, measured against the loan's own
 * ledger. Pure — no database access — so the DPD grid, the loan snapshot and
 * the tests all run the one calculation.
 *
 * The obligation each month is the Interest journal the ledger posts at
 * month-end, net of the TDS credit paired with it — the amount the borrower
 * actually has to remit. Receipts are appropriated exactly as the Ledger's
 * balance bifurcation shows them (allocation.ts): oldest month's interest
 * first, and whatever is left over reduces principal for good. Only
 * interest is ever an obligation here.
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
 * up to the age of the oldest uncleared obligation.
 */

/** RBI-style NBFC delinquency bucket, derived from DPD. */
export type LoanClassification = "STD" | "SMA-0" | "SMA-1" | "SMA-2" | "NPA";

/** STD: 0 DPD. SMA-0: 1-30. SMA-1: 31-60. SMA-2: 61-90. NPA: 90+. */
export function classifyByDpd(dpd: number): LoanClassification {
  if (dpd <= 0) return "STD";
  if (dpd <= 30) return "SMA-0";
  if (dpd <= 60) return "SMA-1";
  if (dpd <= 90) return "SMA-2";
  return "NPA";
}

/**
 * Whole days between two YYYY-MM-DD dates, positive when `to` is later.
 * Parsed as UTC midnight so no local timezone offset can shift a day count.
 */
function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** One due date's net interest, after the receipts have been appropriated to it. */
interface DpdObligation {
  dueDate: string;
  netAmount: number;
  remaining: number;
}

/**
 * The obligations in a ledger, oldest first, as the receipt appropriation
 * leaves them. Months with nothing net to pay are no obligation at all, and
 * two months posted on the same day merge, so each owns a distinct stretch
 * of days.
 */
function toObligations(entries: LedgerEntryRow[]): DpdObligation[] {
  const merged: DpdObligation[] = [];
  for (const o of allocateLedger(entries).obligations) {
    if (o.netAmount <= 0) continue;
    const last = merged[merged.length - 1];
    if (last && last.dueDate === o.dueDate) {
      last.netAmount = round2(last.netAmount + o.netAmount);
      last.remaining = round2(last.remaining + o.remaining);
    } else {
      merged.push({ dueDate: o.dueDate, netAmount: o.netAmount, remaining: o.remaining });
    }
  }
  return merged.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}

export interface DpdAsOf {
  dpdDays: number;
  classification: LoanClassification;
  /** Unpaid remainder of the obligations past due, in rupees — the grid's Balance row. */
  amountOverdue: number;
  oldestOverdueDueDate: string | null;
}

/**
 * Tolerance below which a DPD figure is floating-point dust, not a real
 * fraction of a day (e.g. 15.000000000000002 from 30 x 0.7/1.4).
 */
const DPD_EPSILON = 1e-6;

/**
 * The loan's DPD as at `asOf`, from the entries dated on or before it.
 *
 * Each Receipt received by `asOf` clears the interest posted before it,
 * oldest month first, whichever months it was labelled for; any surplus goes
 * to principal and is not held back for interest posted later. Disbursements
 * (Payments) create no obligation: in an interest-serviced loan the
 * principal is not due until maturity.
 *
 * Only obligations due before `asOf` are overdue. One falling due on `asOf`
 * itself has had no day in which to be paid, so it adds to neither the DPD
 * nor the Balance.
 *
 * The proportional sum is rounded up to a whole day, so any overdue amount
 * left unpaid, however small, reads as at least 1 day past due.
 */
export function computeDpdAsOf(entries: LedgerEntryRow[], asOf: string): DpdAsOf {
  const appropriated = toObligations(entries.filter((e) => e.entryDate <= asOf));

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
