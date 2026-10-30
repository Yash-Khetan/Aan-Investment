import { getDailyRateFraction } from "../interest/dailyRate";
import { calculateRunningBalanceInterest } from "../interest/runningBalance";
import type { InterestBasis } from "../interest/interest.types";
import { allocateLedger } from "./allocation";
import { computeDpdAsOf } from "./dpd";
import type { LedgerEntryRow } from "./ledger.repository";
import type { LedgerBalanceEvent, MonthAccrualConfig } from "./ledger.types";

/**
 * INTEREST ACCRUED TILL TODAY — one loan's interest accumulated through a
 * date, posted and not yet posted together.
 *
 * The ledger posts interest only at month-end, and only for months that have
 * fully elapsed (ledger.service.ts's syncMissingMonthEndJournals). So on any
 * day but the last of a month, the loan has earned interest that no Journal
 * row shows yet. This is the one place that figure is worked out:
 *
 *     accrued till today = interest already posted (gross)
 *                        + interest accrued since the last posted month,
 *                          through today, not yet posted
 *
 * The second part is not a second formula. It is the Interest module's own
 * running-balance daily walk (interest/runningBalance.ts) at the day-count
 * fraction the basis defines (interest/dailyRate.ts) — the identical call
 * ledger.service.ts makes when it posts a month — run over a period that
 * ends today instead of at month-end. A month that has elapsed but is not
 * yet posted is walked in full; the month in progress is walked up to the
 * as-of date. Each month resolves its own configuration, so a stretch
 * spanning a rate change accrues each month at the rate that governs it.
 *
 * Pure — no database access, and no writes of any kind. Nothing here posts a
 * journal, touches an interest configuration or alters a historical row:
 * reading this figure leaves the ledger exactly as it was. The pending
 * postings are simulated in memory (see `simulated` below) purely so that a
 * month following an unposted one accrues on the same balance it will
 * accrue on once the journal is really there.
 *
 * Kept deliberately apart from the two figures it is NOT:
 *
 *   accrued  — earned through today, posted or not. This module.
 *   due      — posted, net of TDS, and still unpaid (snapshot.ts).
 *   overdue  — due, and already past its due date (dpd.ts).
 *
 * The accrual of a month in progress is earned but not yet payable, so it
 * counts in the first and in neither of the others.
 */

/** One accrual month to walk, with the configuration that governs it. */
export interface AccrualPeriod {
  /** First of the accrual month, YYYY-MM-DD. */
  month: string;
  /** Last calendar day of that month, YYYY-MM-DD — where its journal would post. */
  monthEnd: string;
  /** Resolved exactly as a real posting resolves it: the revision in effect on `monthEnd`. */
  config: MonthAccrualConfig;
}

/** One unposted month's accrual, as the walk computed it. */
export interface UnpostedAccrualMonth {
  month: string;
  /** Where the walk stopped: the month's end, or the as-of date for the month in progress. */
  accruedThrough: string;
  interestAmount: number;
  tdsAmount: number;
  interestRatePercent: number;
  interestBasis: InterestBasis;
  includeOpeningClosingDays: boolean;
  /** False for the month in progress, whose figure is still moving. */
  isComplete: boolean;
}

export interface InterestAccrual {
  /** The date the figures are as at, YYYY-MM-DD. */
  asOf: string;

  /**
   * First day of the earliest month this loan accrues interest for — the
   * oldest posted accrual month, or where accrual is due to begin when none
   * is posted yet. Null while the ledger has nothing to accrue on.
   */
  accrualStartDate: string | null;

  /** Interest accumulated through `asOf`, gross of TDS: `postedInterest` + `unpostedInterest`. */
  interestAccruedTillToday: number;
  /** Gross interest on the Journal Interest rows posted on or before `asOf`. */
  postedInterest: number;
  /** Gross interest accrued since the last posted month, through `asOf`, with no journal yet. */
  unpostedInterest: number;
  /** TDS that would be withheld on `unpostedInterest` when those months post. */
  unpostedTds: number;
  /** First day of the unposted stretch. Null when nothing is accruing beyond what is posted. */
  unpostedFrom: string | null;
  /** Each unposted month separately, oldest first. */
  unpostedMonths: UnpostedAccrualMonth[];

  /** Entry date of the latest Journal Interest row posted on or before `asOf`. */
  lastPostedAccrualDate: string | null;
  /** Accrual month of that row, first of the month. */
  lastPostedAccrualMonth: string | null;

  /** TDS deducted at source on accrued interest — posted months as appropriated, plus `unpostedTds`. */
  tdsAdjusted: number;
  /** Interest settled by receipts, as the appropriation waterfall allocated them (allocation.ts). */
  interestPaid: number;
  /** Posted interest, net of TDS, still unpaid — the same figure as the snapshot's `interestOutstanding`. */
  interestDue: number;
  /** Of `interestDue`, the part already past its contractual due date (dpd.ts). */
  interestOverdue: number;

  /**
   * The rate and day-count the figure above was accrued at: the month in
   * progress's configuration, or — once nothing more is accruing — the one
   * snapshotted onto the last posted Journal Interest row. All three are null
   * only when the loan has never accrued and is not accruing.
   */
  interestRatePercent: number | null;
  interestBasis: InterestBasis | null;
  includeOpeningClosingDays: boolean | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Parses a "YYYY-MM-DD" date string as a local calendar date, and builds
 * month boundaries the same way — matching ledger.service.ts exactly, so the
 * walk below is handed the identical Date values a real posting is handed.
 */
export function parseIsoDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** First of the month containing a YYYY-MM-DD date. */
export function monthStartOf(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/** Last calendar day of the month a "YYYY-MM-01" key names. */
export function monthEndOf(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  return toIsoDate(new Date(y!, m!, 0));
}

/** The month key after a "YYYY-MM-01" key. */
export function nextMonthStart(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  return toIsoDate(new Date(y!, m!, 1));
}

/** Rows → signed balance-change events, exactly as ledger.service.ts assembles them for a posting. */
function toBalanceEvents(rows: LedgerEntryRow[]): LedgerBalanceEvent[] {
  return rows.map((row) => ({
    date: parseIsoDate(row.entryDate),
    delta: row.debit ? Number(row.debit) : -(row.credit ? Number(row.credit) : 0),
  }));
}

/**
 * One loan's accrued interest as at `asOf`.
 *
 * `entries` must be the loan's ledger rows in posted order (as every ledger
 * repository read returns them); rows dated after `asOf` are ignored, so a
 * scheduled disbursement or receipt accrues nothing until its date arrives.
 *
 * `periods` are the months with no Journal Interest row yet, oldest first,
 * each carrying the configuration resolved for it — the caller's job, since
 * resolving a configuration is a database read (see accrual.service.ts).
 * Passing none means nothing is accruing beyond what is posted, which is how
 * a CLOSED loan and a loan with an empty ledger both arrive here.
 */
export function computeInterestAccrual(
  entries: LedgerEntryRow[],
  asOf: string,
  periods: AccrualPeriod[] = []
): InterestAccrual {
  const upTo = entries.filter((e) => e.entryDate <= asOf);

  /* ── What is already posted, and how it has been settled ──
     Read through the one appropriation walk the Ledger page, the DPD grid
     and the loan snapshot all read, so none of these figures can disagree
     with what those screens show. */
  const { obligations } = allocateLedger(upTo);

  let postedInterest = 0;
  let postedTds = 0;
  let interestPaid = 0;
  let interestDue = 0;
  for (const o of obligations) {
    postedInterest = round2(postedInterest + o.grossAmount);
    postedTds = round2(postedTds + o.tdsAmount);
    interestPaid = round2(interestPaid + o.paidAmount);
    interestDue = round2(interestDue + o.remaining);
  }

  const interestRows = upTo.filter((e) => e.vchType === "JOURNAL_INTEREST");
  const lastPosted = interestRows[interestRows.length - 1] ?? null;

  /* ── What has accrued since, with no journal yet ──
     Each month is walked by the Interest module's own running-balance
     method at its own configuration. A month that has elapsed but is not
     posted is simulated into the balance afterwards, so the month that
     follows it accrues on the balance it will really accrue on. */
  const events = toBalanceEvents(upTo);
  const simulated: LedgerBalanceEvent[] = [];
  const unpostedMonths: UnpostedAccrualMonth[] = [];
  let unpostedInterest = 0;
  let unpostedTds = 0;

  for (const period of periods) {
    if (period.month > asOf) continue;

    const accruedThrough = period.monthEnd <= asOf ? period.monthEnd : asOf;
    const periodStart = parseIsoDate(period.month);
    const periodEnd = parseIsoDate(accruedThrough);
    const dailyRate = getDailyRateFraction(period.config.interestBasis, period.config.interestRatePercent);

    const interestAmount = round2(
      calculateRunningBalanceInterest({
        events: [...events, ...simulated],
        periodStart,
        periodEnd,
        dailyRate,
        includeOpeningClosingDays: period.config.includeOpeningClosingDays,
      })
    );
    const tdsAmount = round2((interestAmount * period.config.tdsRatePercent) / 100);

    unpostedInterest = round2(unpostedInterest + interestAmount);
    unpostedTds = round2(unpostedTds + tdsAmount);
    unpostedMonths.push({
      month: period.month,
      accruedThrough,
      interestAmount,
      tdsAmount,
      interestRatePercent: period.config.interestRatePercent,
      interestBasis: period.config.interestBasis,
      includeOpeningClosingDays: period.config.includeOpeningClosingDays,
      isComplete: period.monthEnd <= asOf,
    });

    // Dated where its journal would post — the month's own end — so it
    // reaches every day of every later month and no day of this one.
    const postingDate = parseIsoDate(period.monthEnd);
    simulated.push({ date: postingDate, delta: interestAmount }, { date: postingDate, delta: -tdsAmount });
  }

  const openPeriod = unpostedMonths[unpostedMonths.length - 1] ?? null;

  return {
    asOf,
    accrualStartDate: obligations[0]?.month ?? unpostedMonths[0]?.month ?? null,

    interestAccruedTillToday: round2(postedInterest + unpostedInterest),
    postedInterest,
    unpostedInterest,
    unpostedTds,
    unpostedFrom: unpostedMonths[0]?.month ?? null,
    unpostedMonths,

    lastPostedAccrualDate: lastPosted?.entryDate ?? null,
    lastPostedAccrualMonth: lastPosted ? (lastPosted.accrualMonth ?? monthStartOf(lastPosted.entryDate)) : null,

    tdsAdjusted: round2(postedTds + unpostedTds),
    interestPaid,
    interestDue,
    interestOverdue: computeDpdAsOf(upTo, asOf).amountOverdue,

    interestRatePercent:
      openPeriod?.interestRatePercent ?? (lastPosted?.ratePercent != null ? Number(lastPosted.ratePercent) : null),
    interestBasis: openPeriod?.interestBasis ?? ((lastPosted?.interestBasis as InterestBasis | null) ?? null),
    includeOpeningClosingDays:
      openPeriod?.includeOpeningClosingDays ?? (lastPosted?.includeOpeningClosingDays ?? null),
  };
}
