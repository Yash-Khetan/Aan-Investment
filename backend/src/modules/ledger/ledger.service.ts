import { getDailyRateFraction, supportsDailyRate } from "../interest/dailyRate";
import { calculateRunningBalanceInterest } from "../interest/runningBalance";
import { getInterestConfigEffectiveOn } from "../interest/interest.repository";
import type { InterestBasis } from "../interest/interest.types";
import {
  getEntriesForLoan,
  getEntriesUpTo,
  getExistingAccrualMonths,
  getJournalInterestEntriesFromMonth,
  getEarliestEntryDate,
  insertPaymentOrReceipt,
  insertJournalPair,
  getEntryById,
  updateEntryAmountAndRate,
  getLoanRates,
  type LedgerEntryRow,
} from "./ledger.repository";
import { CreateLedgerEntryInput, LedgerBalanceEvent, MonthAccrualConfig } from "./ledger.types";

/**
 * The day-count this ledger has always accrued at, and still does whenever a
 * loan has no interest configuration to read one from — or has one whose basis
 * has no daily-rate concept at all (FULL_MONTH, CUSTOM), which the month-end
 * daily walk below cannot express. Journal rows posted before the basis was
 * snapshotted per row also read back as this, so their amounts reproduce
 * unchanged.
 */
const LEDGER_FALLBACK_BASIS: InterestBasis = "ACTUAL_365";

const LEDGER_FALLBACK_INCLUDE_OPENING_CLOSING_DAYS = false;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function lastDayOfMonth(monthStart: Date): Date {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
}

/**
 * Formats a Date's own calendar day (year/month/date as this process sees
 * them) as "YYYY-MM-DD" — deliberately NOT `toISOString().slice(0, 10)`,
 * which converts through UTC first and silently rolls the date back a day
 * in any positive-UTC-offset timezone (e.g. IST) for a Date built from
 * local y/m/d components, as every date in this module is.
 */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parses a "YYYY-MM-DD" DB date string as a local calendar date — the mirror of toIsoDate, avoiding `new Date(string)`'s UTC-midnight parsing. */
function parseIsoDate(dateStr: string): Date {
  const parts = dateStr.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(y, m - 1, d);
}

/** Rows → signed balance-change events. Payment/Journal-Interest increase, Receipt/Journal-TDS decrease. */
function toBalanceEvents(rows: LedgerEntryRow[]): LedgerBalanceEvent[] {
  return rows.map((row) => ({
    date: parseIsoDate(row.entryDate),
    delta: row.debit ? Number(row.debit) : -(row.credit ? Number(row.credit) : 0),
  }));
}

/**
 * Assembles the balance-change events feeding a month's running-balance
 * interest calculation. Includes every prior entry — Payment, Receipt, and
 * previously-posted Journal Interest/TDS — so unpaid interest compounds
 * into the balance later months accrue interest on, matching the source
 * Excel ledger's behavior.
 *
 * `excludeAccrualMonth` drops that month's own Journal Interest/TDS rows
 * from the walk — used when recomputing a month's own Journal pair, so its
 * stale prior amount doesn't feed into the balance being used to replace it.
 */
export async function assembleMonthBalanceEvents(
  loanId: string,
  monthEnd: string,
  excludeAccrualMonth?: string
): Promise<LedgerBalanceEvent[]> {
  const rows = await getEntriesUpTo(loanId, monthEnd);
  const filtered = excludeAccrualMonth ? rows.filter((r) => r.accrualMonth !== excludeAccrualMonth) : rows;
  return toBalanceEvents(filtered);
}

/* ============================================================
   CONFIGURATION — READ, NEVER OWNED

   This ledger holds no rates or day-count settings of its own.
   Every figure it accrues comes from the Loan module and the
   Interest module's effective-dated configuration, resolved for
   the month being accrued. See resolveAccrualConfig below.
============================================================ */

/**
 * The interest configuration a given month must accrue under: the
 * interest_configs revision in effect on that month's end date, falling back
 * to the loan's own rates when the loan has no configuration at all.
 *
 * Resolving per month — rather than always reading the loan's current values —
 * is what gives a configuration change its effective point. A month that
 * elapsed before the change resolves the revision that governed it, so a rate
 * saved today cannot reach back into an earlier month's accrual.
 */
export async function resolveAccrualConfig(loanId: string, monthEnd: Date): Promise<MonthAccrualConfig> {
  const config = await getInterestConfigEffectiveOn(loanId, toIsoDate(monthEnd));

  if (!config) {
    const rates = await getLoanRates(loanId);
    return {
      interestRatePercent: Number(rates.defaultInterestRatePercent),
      tdsRatePercent: Number(rates.defaultTdsRatePercent),
      interestBasis: LEDGER_FALLBACK_BASIS,
      includeOpeningClosingDays: LEDGER_FALLBACK_INCLUDE_OPENING_CLOSING_DAYS,
    };
  }

  return {
    interestRatePercent: Number(config.annualRate),
    tdsRatePercent: Number(config.tdsRatePercent),
    interestBasis: supportsDailyRate(config.interestBasis) ? config.interestBasis : LEDGER_FALLBACK_BASIS,
    includeOpeningClosingDays: config.includeOpeningClosingDays ?? LEDGER_FALLBACK_INCLUDE_OPENING_CLOSING_DAYS,
  };
}

/**
 * One month's Interest and TDS at a given configuration. The calculation
 * itself is the Interest module's, unchanged — the running-balance daily walk
 * over the ledger's own balance events, at the day-count fraction the basis
 * defines.
 */
async function computeMonthInterestAndTds(
  loanId: string,
  monthStart: Date,
  monthEnd: Date,
  config: MonthAccrualConfig,
  excludeAccrualMonth?: string
): Promise<{ interestAmount: number; tdsAmount: number }> {
  const events = await assembleMonthBalanceEvents(loanId, toIsoDate(monthEnd), excludeAccrualMonth);
  const dailyRate = getDailyRateFraction(config.interestBasis, config.interestRatePercent);

  const interestAmount = round2(
    calculateRunningBalanceInterest({
      events,
      periodStart: monthStart,
      periodEnd: monthEnd,
      dailyRate,
      includeOpeningClosingDays: config.includeOpeningClosingDays,
    })
  );

  const tdsAmount = round2((interestAmount * config.tdsRatePercent) / 100);

  return { interestAmount, tdsAmount };
}

/**
 * Posts a month's Journal Interest/TDS pair at the configuration in effect for
 * that month, and snapshots that configuration onto the rows — so the month
 * keeps what it was calculated under no matter what the loan's configuration
 * becomes later.
 */
export async function generateMonthEndJournalPair(loanId: string, monthStart: Date) {
  const monthEnd = lastDayOfMonth(monthStart);
  const config = await resolveAccrualConfig(loanId, monthEnd);
  const { interestAmount, tdsAmount } = await computeMonthInterestAndTds(loanId, monthStart, monthEnd, config);

  return insertJournalPair({
    loanId,
    entryDate: toIsoDate(monthEnd),
    accrualMonth: toIsoDate(new Date(monthStart.getFullYear(), monthStart.getMonth(), 1)),
    interestAmount,
    interestRatePercent: config.interestRatePercent,
    tdsAmount,
    tdsRatePercent: config.tdsRatePercent,
    interestBasis: config.interestBasis,
    includeOpeningClosingDays: config.includeOpeningClosingDays,
  });
}

/**
 * Self-heal: generates any missing month-end Journal pair for every
 * calendar month between the loan's first ledger entry and the last
 * fully-elapsed month, in chronological order (each month's balance
 * depends on prior months' posted entries, so they can't be generated out
 * of order or in parallel). Silent — a failure here must never block a
 * ledger read.
 *
 * Each generated month resolves its own configuration, so back-filling a
 * stretch that spans a configuration change gives every month the values
 * that were in effect for it rather than today's.
 */
export async function syncMissingMonthEndJournals(loanId: string): Promise<void> {
  try {
    const earliest = await getEarliestEntryDate(loanId);
    if (!earliest) return;

    const existingMonths = new Set(await getExistingAccrualMonths(loanId));

    const today = new Date();
    const earliestDate = parseIsoDate(earliest);
    let cursor = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
    const lastElapsedMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    while (cursor.getTime() <= lastElapsedMonthStart.getTime()) {
      const monthKey = toIsoDate(cursor);
      if (!existingMonths.has(monthKey)) {
        await generateMonthEndJournalPair(loanId, cursor);
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  } catch {
    // Missing prerequisites (no entries yet, etc.) — nothing to do.
  }
}

/**
 * The configuration an already-posted Journal Interest row was calculated
 * under, read back off the row itself. Rows posted before the basis was
 * snapshotted carry null and read back as the ledger's historical defaults,
 * so their amounts reproduce exactly.
 */
function configOfPostedEntry(interestEntry: LedgerEntryRow, tdsRatePercent: number): MonthAccrualConfig {
  return {
    interestRatePercent: Number(interestEntry.ratePercent ?? 21),
    tdsRatePercent,
    interestBasis: (interestEntry.interestBasis as InterestBasis | null) ?? LEDGER_FALLBACK_BASIS,
    includeOpeningClosingDays:
      interestEntry.includeOpeningClosingDays ?? LEDGER_FALLBACK_INCLUDE_OPENING_CLOSING_DAYS,
  };
}

/**
 * Recomputes every already-posted Journal Interest/TDS pair whose accrual
 * month is on or after `fromDate`'s month, oldest first — cascading forward
 * since each month's balance (and therefore interest) depends on the ones
 * before it. Called after a backdated Payment/Receipt lands before Journal
 * entries that already exist, so the ledger stays internally consistent
 * without a manual step.
 *
 * Only the BALANCE moves here. Each month is recomputed at its own
 * snapshotted configuration — rate, TDS rate, basis and day-count
 * inclusivity all read back off the row — never at the loan's current one.
 * A configuration change alone therefore never reaches a posted month.
 */
export async function recomputeMonthsFrom(loanId: string, fromDate: Date): Promise<void> {
  const fromMonthKey = toIsoDate(new Date(fromDate.getFullYear(), fromDate.getMonth(), 1));
  const interestEntries = await getJournalInterestEntriesFromMonth(loanId, fromMonthKey);

  for (const interestEntry of interestEntries) {
    const accrualMonth = interestEntry.accrualMonth as string;
    const monthStart = parseIsoDate(accrualMonth);
    const monthEnd = lastDayOfMonth(monthStart);

    const tdsEntry = interestEntry.pairedEntryId ? await getEntryById(interestEntry.pairedEntryId) : null;
    const tdsRate = Number(tdsEntry?.ratePercent ?? 10);
    const config = configOfPostedEntry(interestEntry, tdsRate);

    const { interestAmount, tdsAmount } = await computeMonthInterestAndTds(
      loanId,
      monthStart,
      monthEnd,
      config,
      accrualMonth
    );

    await updateEntryAmountAndRate(interestEntry.id, {
      ratePercent: config.interestRatePercent,
      debit: interestAmount,
    });

    if (tdsEntry) {
      await updateEntryAmountAndRate(tdsEntry.id, { ratePercent: tdsRate, credit: tdsAmount });
    }
  }
}

export async function recordPaymentOrReceipt(input: CreateLedgerEntryInput): Promise<LedgerEntryRow> {
  const created = await insertPaymentOrReceipt({
    loanId: input.loanId,
    entryDate: input.entryDate,
    vchType: input.vchType,
    amount: input.amount,
    narration: input.narration,
  });

  await recomputeMonthsFrom(input.loanId, parseIsoDate(input.entryDate));

  return created;
}

/**
 * The configuration this ledger is currently accruing at, for display only.
 * Read-only by design: rates and day-count are edited in the Loan module,
 * which is the source of the current configuration, and this ledger has no
 * write path back to them.
 */
export async function getSettings(loanId: string) {
  const rates = await getLoanRates(loanId);
  const config = await resolveAccrualConfig(loanId, new Date());

  return {
    ...rates,
    currentInterestRatePercent: String(config.interestRatePercent),
    currentTdsRatePercent: String(config.tdsRatePercent),
    interestBasis: config.interestBasis,
    includeOpeningClosingDays: config.includeOpeningClosingDays,
  };
}

/** Full ledger for a loan: self-heals missing month-end journals, then returns entries with a computed running balance. */
export async function getLoanLedger(loanId: string) {
  await syncMissingMonthEndJournals(loanId);

  const rows = await getEntriesForLoan(loanId);

  let balance = 0;
  const entries = rows.map((row) => {
    balance += row.debit ? Number(row.debit) : 0;
    balance -= row.credit ? Number(row.credit) : 0;
    return { ...row, balance };
  });

  const settings = await getSettings(loanId);

  return { entries, settings };
}
