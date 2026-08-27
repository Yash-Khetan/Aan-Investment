import { db } from "../../db";
import { getDailyRateFraction } from "../interest/dailyRate";
import { calculateRunningBalanceInterest } from "../interest/runningBalance";
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
  updateLoanRates,
  type LedgerEntryRow,
} from "./ledger.repository";
import { CreateLedgerEntryInput, LedgerBalanceEvent, UpdateLedgerSettingsInput } from "./ledger.types";

const INTEREST_BASIS = "ACTUAL_365";

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

async function computeMonthInterestAndTds(
  loanId: string,
  monthStart: Date,
  monthEnd: Date,
  interestRatePercent: number,
  tdsRatePercent: number
): Promise<{ interestAmount: number; tdsAmount: number }> {
  const events = await assembleMonthBalanceEvents(loanId, toIsoDate(monthEnd));
  const dailyRate = getDailyRateFraction(INTEREST_BASIS, interestRatePercent);

  const interestAmount = round2(
    calculateRunningBalanceInterest({
      events,
      periodStart: monthStart,
      periodEnd: monthEnd,
      dailyRate,
      includeOpeningClosingDays: false,
    })
  );

  const tdsAmount = round2((interestAmount * tdsRatePercent) / 100);

  return { interestAmount, tdsAmount };
}

export async function generateMonthEndJournalPair(
  loanId: string,
  monthStart: Date,
  interestRatePercent: number,
  tdsRatePercent: number
) {
  const monthEnd = lastDayOfMonth(monthStart);
  const { interestAmount, tdsAmount } = await computeMonthInterestAndTds(
    loanId,
    monthStart,
    monthEnd,
    interestRatePercent,
    tdsRatePercent
  );

  return insertJournalPair({
    loanId,
    entryDate: toIsoDate(monthEnd),
    accrualMonth: toIsoDate(new Date(monthStart.getFullYear(), monthStart.getMonth(), 1)),
    interestAmount,
    interestRatePercent,
    tdsAmount,
    tdsRatePercent,
  });
}

/**
 * Self-heal: generates any missing month-end Journal pair for every
 * calendar month between the loan's first ledger entry and the last
 * fully-elapsed month, in chronological order (each month's balance
 * depends on prior months' posted entries, so they can't be generated out
 * of order or in parallel). Silent — a failure here must never block a
 * ledger read.
 */
export async function syncMissingMonthEndJournals(loanId: string): Promise<void> {
  try {
    const earliest = await getEarliestEntryDate(loanId);
    if (!earliest) return;

    const rates = await getLoanRates(loanId);
    const interestRate = Number(rates.defaultInterestRatePercent);
    const tdsRate = Number(rates.defaultTdsRatePercent);

    const existingMonths = new Set(await getExistingAccrualMonths(loanId));

    const today = new Date();
    const earliestDate = parseIsoDate(earliest);
    let cursor = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
    const lastElapsedMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    while (cursor.getTime() <= lastElapsedMonthStart.getTime()) {
      const monthKey = toIsoDate(cursor);
      if (!existingMonths.has(monthKey)) {
        await generateMonthEndJournalPair(loanId, cursor, interestRate, tdsRate);
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  } catch {
    // Missing prerequisites (no entries yet, etc.) — nothing to do.
  }
}

/**
 * Recomputes every already-posted Journal Interest/TDS pair whose accrual
 * month is on or after `fromDate`'s month, oldest first — cascading forward
 * since each month's balance (and therefore interest) depends on the ones
 * before it. Each month keeps its own previously-set rate rather than
 * resetting to the loan's current rate. Called after a backdated
 * Payment/Receipt lands before Journal entries that already exist, so the
 * ledger stays internally consistent without a manual step.
 */
export async function recomputeMonthsFrom(loanId: string, fromDate: Date): Promise<void> {
  const fromMonthKey = toIsoDate(new Date(fromDate.getFullYear(), fromDate.getMonth(), 1));
  const interestEntries = await getJournalInterestEntriesFromMonth(loanId, fromMonthKey);

  for (const interestEntry of interestEntries) {
    const accrualMonth = interestEntry.accrualMonth as string;
    const monthStart = parseIsoDate(accrualMonth);
    const monthEnd = lastDayOfMonth(monthStart);
    const interestRate = Number(interestEntry.ratePercent ?? 21);

    const events = await assembleMonthBalanceEvents(loanId, toIsoDate(monthEnd), accrualMonth);
    const dailyRate = getDailyRateFraction(INTEREST_BASIS, interestRate);

    const interestAmount = round2(
      calculateRunningBalanceInterest({
        events,
        periodStart: monthStart,
        periodEnd: monthEnd,
        dailyRate,
        includeOpeningClosingDays: false,
      })
    );

    await updateEntryAmountAndRate(interestEntry.id, { ratePercent: interestRate, debit: interestAmount });

    if (interestEntry.pairedEntryId) {
      const tdsEntry = await getEntryById(interestEntry.pairedEntryId);
      if (tdsEntry) {
        const tdsRate = Number(tdsEntry.ratePercent ?? 10);
        const tdsAmount = round2((interestAmount * tdsRate) / 100);
        await updateEntryAmountAndRate(tdsEntry.id, { ratePercent: tdsRate, credit: tdsAmount });
      }
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
 * Edits a Journal row's rate and recomputes its amount. Interest-row edits
 * recompute that month's interest AND its paired TDS row (using the TDS
 * row's own, independently editable rate). TDS-row edits only touch that
 * row. Never cascades into other months, and never writes back to the loan
 * — a standalone correction, not a change of the loan's rate.
 */
export async function editJournalEntryRate(entryId: string, newRatePercent: number): Promise<void> {
  const entry = await getEntryById(entryId);
  if (!entry) {
    throw new Error(`Ledger entry ${entryId} not found.`);
  }
  if (entry.vchType !== "JOURNAL_INTEREST" && entry.vchType !== "JOURNAL_TDS") {
    throw new Error("Only Journal Interest/TDS entries have an editable rate.");
  }
  if (!entry.accrualMonth) {
    throw new Error(`Ledger entry ${entryId} has no accrual month.`);
  }

  await db.transaction(async (tx) => {
    if (entry.vchType === "JOURNAL_INTEREST") {
      const monthStart = parseIsoDate(entry.accrualMonth as string);
      const monthEnd = lastDayOfMonth(monthStart);
      const events = await assembleMonthBalanceEvents(entry.loanId, toIsoDate(monthEnd), entry.accrualMonth as string);
      const dailyRate = getDailyRateFraction(INTEREST_BASIS, newRatePercent);

      const interestAmount = round2(
        calculateRunningBalanceInterest({
          events,
          periodStart: monthStart,
          periodEnd: monthEnd,
          dailyRate,
          includeOpeningClosingDays: false,
        })
      );

      await updateEntryAmountAndRate(entry.id, { ratePercent: newRatePercent, debit: interestAmount }, tx);

      if (entry.pairedEntryId) {
        const tdsEntry = await getEntryById(entry.pairedEntryId);
        if (tdsEntry) {
          const tdsRate = Number(tdsEntry.ratePercent ?? 10);
          const tdsAmount = round2((interestAmount * tdsRate) / 100);
          await updateEntryAmountAndRate(tdsEntry.id, { ratePercent: tdsRate, credit: tdsAmount }, tx);
        }
      }
    } else {
      // JOURNAL_TDS: recompute off the paired interest row's current amount.
      const interestEntry = entry.pairedEntryId ? await getEntryById(entry.pairedEntryId) : null;
      const interestAmount = interestEntry?.debit ? Number(interestEntry.debit) : 0;
      const tdsAmount = round2((interestAmount * newRatePercent) / 100);
      await updateEntryAmountAndRate(entry.id, { ratePercent: newRatePercent, credit: tdsAmount }, tx);
    }
  });
}

/** The loan's own Interest/TDS rates, which are what this ledger accrues at. */
export async function getSettings(loanId: string) {
  return getLoanRates(loanId);
}

/**
 * Writes both rates straight onto the loan row, so the change is what the
 * Loans module shows too. Already-posted Journal entries keep the rate they
 * accrued at — only months generated from here on use the new value.
 */
export async function updateLedgerSettings(loanId: string, input: UpdateLedgerSettingsInput) {
  return updateLoanRates(loanId, input);
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

  const settings = await getLoanRates(loanId);

  return { entries, settings };
}
