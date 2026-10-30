import { firstSystemAccrualMonth } from "../kpi-ledger/sheet";
import {
  computeInterestAccrual,
  monthEndOf,
  monthStartOf,
  nextMonthStart,
  parseIsoDate,
  type AccrualPeriod,
  type InterestAccrual,
} from "./accrual";
import { getHistoryCutoff, getLoanStatuses, type LedgerEntryRow } from "./ledger.repository";
import { resolveAccrualConfig } from "./ledger.service";
import { computeLoanSnapshot, type LoanSnapshot } from "./snapshot";
import { getSyncedLedgers, todayIso } from "./snapshot.service";

/**
 * Interest accrued till today, for real loans — the database reads that
 * accrual.ts deliberately does not do.
 *
 * Two things have to be looked up before the pure walk can run: which months
 * have no Journal Interest row yet, and the interest configuration each of
 * those months must accrue under. Both are read, never written. Nothing in
 * this module posts a journal, fills a gap or touches a configuration: the
 * figure is derived on read and stored nowhere, exactly as every other loan
 * figure in this module is.
 *
 * The eligibility rules are not this module's own. They are read off the
 * ledger's existing month-end posting rule (ledger.service.ts's
 * syncMissingMonthEndJournals), so a loan accrues here if and only if it
 * would accrue there:
 *
 *   - a loan with no ledger entries accrues nothing;
 *   - a CLOSED loan accrues nothing beyond what is already posted;
 *   - months covered by imported history are never accrued again — the
 *     sheet's own Interest journals stand for them, and accrual takes over
 *     from the month after the last imported one;
 *   - every other lifecycle status accrues, as it already does at month-end.
 */

/**
 * The months with no Journal Interest row yet, oldest first, each with the
 * configuration resolved for it — the revision in effect on that month's end
 * date, which is what the month will really post under.
 *
 * Empty when nothing is accruing. A loan with no interest configuration at
 * all resolves to empty rather than throwing: a defect in one loan's setup
 * must not take down a dashboard read, and the same read's month-end posting
 * already fails silently for it.
 */
async function resolveAccrualPeriods(
  loanId: string,
  entries: LedgerEntryRow[],
  asOf: string,
  status: string | null,
): Promise<AccrualPeriod[]> {
  if (entries.length === 0) return [];
  if (status === "CLOSED") return [];

  const postedMonths = entries
    .filter((e) => e.vchType === "JOURNAL_INTEREST")
    .map((e) => e.accrualMonth ?? monthStartOf(e.entryDate));

  // From the month after the last one posted. Taking the LAST, not the first
  // gap, is what keeps this from ever double-counting: a month missing behind
  // a posted one has already compounded into that posted month's balance, and
  // the ledger's own self-heal is what fills it.
  let cursor: string;
  if (postedMonths.length > 0) {
    cursor = nextMonthStart(postedMonths.reduce((latest, m) => (m > latest ? m : latest)));
  } else {
    const { lastInterestMonth } = await getHistoryCutoff(loanId);
    cursor = firstSystemAccrualMonth(monthStartOf(entries[0]!.entryDate), lastInterestMonth);
  }

  const finalMonth = monthStartOf(asOf);
  const periods: AccrualPeriod[] = [];

  while (cursor <= finalMonth) {
    const monthEnd = monthEndOf(cursor);
    try {
      periods.push({
        month: cursor,
        monthEnd,
        config: await resolveAccrualConfig(loanId, parseIsoDate(monthEnd)),
      });
    } catch {
      // No interest configuration for this loan — nothing can be accrued for
      // it, and the posted figures below still stand.
      return [];
    }
    cursor = nextMonthStart(cursor);
  }

  return periods;
}

/**
 * Accrued interest for several loans, keyed by loan id, from ledgers already
 * read. Every requested loan is present; one with an empty ledger gets an
 * all-zero accrual rather than being left out.
 *
 * Takes the ledgers rather than fetching them, so a caller that already has
 * them — the dashboard, the loan detail page — pays for one read, not two.
 */
export async function getAccrualsFromLedgers(
  ledgers: Map<string, LedgerEntryRow[]>,
  asOf: string = todayIso(),
): Promise<Map<string, InterestAccrual>> {
  const loanIds = [...ledgers.keys()];
  const statuses = await getLoanStatuses(loanIds);

  const computed = await Promise.all(
    loanIds.map(async (loanId) => {
      const entries = ledgers.get(loanId)!;
      const upTo = entries.filter((e) => e.entryDate <= asOf);
      const periods = await resolveAccrualPeriods(loanId, upTo, asOf, statuses.get(loanId) ?? null);
      return [loanId, computeInterestAccrual(entries, asOf, periods)] as const;
    }),
  );

  return new Map(computed);
}

/**
 * Each loan's snapshot and its accrued interest together, from one read of
 * the ledgers. The pair every screen that shows both wants: the dashboard
 * sums them across the portfolio, the loan detail page shows one loan's.
 */
export async function getLoanLedgerFigures(
  loanIds: string[],
  asOf: string = todayIso(),
): Promise<Map<string, { snapshot: LoanSnapshot; accrual: InterestAccrual }>> {
  const ledgers = await getSyncedLedgers(loanIds);
  const accruals = await getAccrualsFromLedgers(ledgers, asOf);

  const result = new Map<string, { snapshot: LoanSnapshot; accrual: InterestAccrual }>();
  for (const [loanId, entries] of ledgers) {
    result.set(loanId, { snapshot: computeLoanSnapshot(entries, asOf), accrual: accruals.get(loanId)! });
  }
  return result;
}

/** One loan's accrued interest, for a caller that has nothing read yet. */
export async function getLoanAccrual(loanId: string, asOf?: string): Promise<InterestAccrual> {
  const figures = await getLoanLedgerFigures([loanId], asOf);
  return figures.get(loanId)!.accrual;
}
