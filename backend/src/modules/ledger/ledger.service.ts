import { BadRequestError, ForbiddenError, NotFoundError } from "../../common/errors";
import { AUDIT_ENTITY, recordAudit } from "../audit";
import { firstSystemAccrualMonth } from "../kpi-ledger/sheet";
import { getDailyRateFraction } from "../interest/dailyRate";
import { calculateRunningBalanceInterest } from "../interest/runningBalance";
import { getInterestConfigEffectiveOn } from "../interest/interest.repository";
import type { InterestBasis } from "../interest/interest.types";
import {
  deleteManualEntry,
  getEntriesForLoan,
  getEntriesUpTo,
  getExistingAccrualMonths,
  getJournalInterestEntriesFromMonth,
  getEarliestEntryDate,
  getLoanEntryById,
  inLedgerTransaction,
  insertPaymentOrReceipt,
  insertJournalPair,
  getEntryById,
  updateEntryAmountAndRate,
  updateManualEntry,
  getHistoryCutoff,
  getLoanStatus,
  type LedgerEntryRow,
} from "./ledger.repository";
import {
  CreateLedgerEntryInput,
  DeleteLedgerEntryInput,
  LedgerBalanceEvent,
  MonthAccrualConfig,
  UpdateLedgerEntryInput,
} from "./ledger.types";
import { allocateLedger } from "./allocation";
import { describeEntry, diffFields, entryFields, patchFields, toRowValues } from "./entryRules";

/**
 * What a Journal row posted before the basis was snapshotted per row reads
 * back as — the day-count this ledger accrued at then — so such rows
 * reproduce their amounts unchanged on recompute.
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
 * interest_configs revision in effect on that month's end date. Every loan
 * is created with one, so a loan without any is a defect, not a default.
 *
 * Resolving per month — rather than always reading the loan's current values —
 * is what gives a configuration change its effective point. A month that
 * elapsed before the change resolves the revision that governed it, so a rate
 * saved today cannot reach back into an earlier month's accrual.
 */
export async function resolveAccrualConfig(loanId: string, monthEnd: Date): Promise<MonthAccrualConfig> {
  const config = await getInterestConfigEffectiveOn(loanId, toIsoDate(monthEnd));

  if (!config) {
    throw new NotFoundError(`Loan ${loanId} has no interest configuration.`);
  }

  return {
    interestRatePercent: Number(config.annualRate),
    tdsRatePercent: Number(config.tdsRatePercent),
    interestBasis: config.interestBasis,
    includeOpeningClosingDays: config.includeOpeningClosingDays,
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
 * Months covered by imported history are never generated: the sheet's own
 * Interest journals stand for them, and the ledger takes over from the month
 * after the last one. A CLOSED loan accrues nothing.
 *
 * Each generated month resolves its own configuration, so back-filling a
 * stretch that spans a configuration change gives every month the values
 * that were in effect for it rather than today's.
 */
export async function syncMissingMonthEndJournals(loanId: string): Promise<void> {
  try {
    const earliest = await getEarliestEntryDate(loanId);
    if (!earliest) return;
    if ((await getLoanStatus(loanId)) === "CLOSED") return;

    const existingMonths = new Set(await getExistingAccrualMonths(loanId));
    const { lastInterestMonth } = await getHistoryCutoff(loanId);

    const today = new Date();
    let cursor = parseIsoDate(firstSystemAccrualMonth(`${earliest.slice(0, 7)}-01`, lastInterestMonth));
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

/**
 * Imported history is the record up to its last row; nothing is added — or
 * moved — by hand inside it. Applies to a new entry's date and to an edited
 * one's new date alike.
 */
async function assertDateAfterImportedHistory(loanId: string, entryDate: string): Promise<void> {
  const { lastEntryDate } = await getHistoryCutoff(loanId);
  if (lastEntryDate && entryDate <= lastEntryDate) {
    throw new BadRequestError(
      `This loan's imported history runs to ${lastEntryDate}. Entries on or before that date come from the imported sheet; record this one with a later date.`,
      { field: "entryDate" },
    );
  }
}

export async function recordPaymentOrReceipt(input: CreateLedgerEntryInput): Promise<LedgerEntryRow> {
  await assertDateAfterImportedHistory(input.loanId, input.entryDate);

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

/* ============================================================
   EDITING AND REMOVING A HAND-RECORDED ENTRY

   Only a MANUAL Payment/Receipt can be changed, and only its
   date, side, amount and narration — entryRules.ts is the one
   place that decides, and the repository's own WHERE clauses
   are the floor under it.

   An IMPORTED row is LOCKED: it is refused here, so a request
   straight at the API is refused exactly as the UI's missing
   Edit button implies. Nothing is written on the way to that
   refusal.

   What a permitted change moves, and what it must not:

     - the row's own four columns, in one transaction with its
       audit-trail entry;
     - the ledger's own month-end Interest/TDS pairs from the
       earlier of the old and new dates onward, through
       recomputeMonthsFrom — each at the configuration IT was
       posted under, read back off the row. Rates, bases,
       day-count inclusivity and TDS snapshots are therefore
       preserved exactly; only the balance each month accrued on
       moves. Imported journals are never in that set.
     - nothing else. Running balances, bifurcation, receipt
       appropriation, DPD and every loan figure are computed on
       read from these rows (allocation.ts, snapshot.ts,
       dpd.service.ts), so they follow the edit with nothing
       stored to go stale.

   No journal is created here, and none is duplicated: the edit
   paths only UPDATE existing pairs. A month that genuinely has
   none is filled by the usual self-heal, which is idempotent
   against `ledger_accrual_month_idx`.
============================================================ */

/** The entry, if it exists on that loan and may be changed. Throws the reason if not. */
async function loadEditableEntry(loanId: string, entryId: string): Promise<LedgerEntryRow> {
  const entry = await getLoanEntryById(loanId, entryId);
  if (!entry) {
    throw new NotFoundError(`Ledger entry ${entryId} was not found on loan ${loanId}.`);
  }

  const permissions = describeEntry(entry);
  if (!permissions.isEditable) {
    throw new ForbiddenError(permissions.lockReason!, {
      entryId,
      isLocked: permissions.isLocked,
      source: entry.source,
    });
  }

  return entry;
}

/**
 * Applies an edit to one hand-recorded Payment/Receipt and brings everything
 * that depends on it back into step. Returns the row unchanged — writing
 * nothing — when the patch asks for nothing the row does not already say.
 */
export async function updateLedgerEntry(input: UpdateLedgerEntryInput): Promise<LedgerEntryRow> {
  const entry = await loadEditableEntry(input.loanId, input.entryId);

  const before = entryFields(entry);
  const after = patchFields(before, input.patch);
  const diff = diffFields(before, after);
  if (!diff) return entry;

  if (after.entryDate !== before.entryDate) {
    await assertDateAfterImportedHistory(input.loanId, after.entryDate);
  }

  const updated = await inLedgerTransaction(async (tx) => {
    const row = await updateManualEntry(input.entryId, toRowValues(after), tx);
    // Matched nothing: the row stopped being editable between the check above
    // and here — an import landing concurrently. The transaction is abandoned,
    // so nothing is written and nothing is logged.
    if (!row) {
      throw new ForbiddenError("This entry was locked while the change was being made, so nothing was changed.", {
        entryId: input.entryId,
      });
    }

    await recordAudit(
      {
        actor: input.actor,
        action: "UPDATE",
        entityType: AUDIT_ENTITY.LEDGER_ENTRY,
        entityId: input.entryId,
        oldValues: { loanId: input.loanId, vchNo: entry.vchNo, ...diff.before },
        newValues: diff.after,
      },
      tx,
    );

    return row;
  });

  // From the earlier of the two dates: moving an entry backwards changes the
  // balance every month from its new date on, forwards from its old one.
  const earliest = after.entryDate < before.entryDate ? after.entryDate : before.entryDate;
  await recomputeMonthsFrom(input.loanId, parseIsoDate(earliest));

  return updated;
}

/**
 * Removes one hand-recorded Payment/Receipt, then recalculates the ledger's
 * own month-end interest from its date onward. A locked (imported) row is
 * refused: the only thing that removes imported rows is removing the import.
 */
export async function deleteLedgerEntry(input: DeleteLedgerEntryInput): Promise<LedgerEntryRow> {
  const entry = await loadEditableEntry(input.loanId, input.entryId);
  const fields = entryFields(entry);

  const removed = await inLedgerTransaction(async (tx) => {
    const row = await deleteManualEntry(input.entryId, tx);
    if (!row) {
      throw new ForbiddenError("This entry was locked while it was being removed, so nothing was removed.", {
        entryId: input.entryId,
      });
    }

    await recordAudit(
      {
        actor: input.actor,
        action: "DELETE",
        entityType: AUDIT_ENTITY.LEDGER_ENTRY,
        entityId: input.entryId,
        oldValues: { loanId: input.loanId, vchNo: entry.vchNo, ...fields },
      },
      tx,
    );

    return row;
  });

  await recomputeMonthsFrom(input.loanId, parseIsoDate(fields.entryDate));

  return removed;
}

/**
 * The configuration this ledger is currently accruing at, for display only.
 * Read-only by design: rates and day-count are edited in the Loan module,
 * which is the source of the current configuration, and this ledger has no
 * write path back to them.
 */
export async function getSettings(loanId: string) {
  const config = await resolveAccrualConfig(loanId, new Date());

  return {
    loanId,
    currentInterestRatePercent: String(config.interestRatePercent),
    currentTdsRatePercent: String(config.tdsRatePercent),
    interestBasis: config.interestBasis,
    includeOpeningClosingDays: config.includeOpeningClosingDays,
  };
}

/**
 * Full ledger for a loan: self-heals missing month-end journals, then returns
 * entries with a computed running balance, what that balance is made of,
 * — on Receipts — how the receipt was appropriated, and whether each row may
 * be changed.
 *
 * The lock state travels with the row rather than being worked out again in
 * the browser: the Edit button a user sees and the answer the edit route
 * gives both come from entryRules.ts, so they cannot disagree.
 */
export async function getLoanLedger(loanId: string) {
  await syncMissingMonthEndJournals(loanId);

  const rows = await getEntriesForLoan(loanId);
  const allocation = allocateLedger(rows);

  // Entries dated after today are scheduled: they sort after every posted
  // entry, so posted balances are untouched by them, and theirs is projected.
  const today = toIsoDate(new Date());
  let balance = 0;
  const entries = rows.map((row) => {
    balance += row.debit ? Number(row.debit) : 0;
    balance -= row.credit ? Number(row.credit) : 0;
    return {
      ...row,
      ...describeEntry(row),
      isScheduled: row.entryDate > today,
      balance,
      bifurcation: allocation.bifurcationAfter.get(row.id)!,
      allocation: allocation.receipts.get(row.id) ?? null,
    };
  });

  const settings = await getSettings(loanId);

  return { entries, settings };
}
