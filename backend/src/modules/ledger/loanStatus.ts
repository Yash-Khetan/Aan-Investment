import { getEntriesForLoan, getLoanStatus, setLoanStatus } from "./ledger.repository";
import { syncMissingMonthEndJournals } from "./ledger.service";
import { computeLoanSnapshot } from "./snapshot";
import { todayIso } from "./snapshot.service";

/** A balance at or below this is settled — rounding, not money owed. */
const SETTLED_TOLERANCE = 0.005;

/**
 * Keeps a loan's ACTIVE/CLOSED status in step with its ledger, after anything
 * that writes to the ledger:
 *
 *   - A loan that has had money lent and now owes nothing — balance zero as of
 *     today and nothing scheduled — is CLOSED. A closed loan accrues no
 *     further month-end interest.
 *   - A CLOSED loan whose balance is no longer zero (a new disbursement, a
 *     removed import) is ACTIVE again.
 *
 * A loan still waiting on a scheduled entry is not closed: when that entry's
 * date arrives it has to start accruing without anyone touching the loan.
 * PENDING and WRITTEN_OFF are decisions people make and are left alone, except
 * that a PENDING loan that has been lent and fully repaid closes.
 *
 * Returns the status the loan ends up with.
 */
export async function syncLoanStatusWithLedger(loanId: string): Promise<string | null> {
  const status = await getLoanStatus(loanId);
  if (status === "WRITTEN_OFF") return status;

  await syncMissingMonthEndJournals(loanId);

  const today = todayIso();
  const entries = await getEntriesForLoan(loanId);
  const snapshot = computeLoanSnapshot(entries, today);
  const hasScheduled = entries.some((e) => e.entryDate > today);

  const settled =
    snapshot.totalDisbursed > 0 && Math.abs(snapshot.closingBalance) <= SETTLED_TOLERANCE && !hasScheduled;

  if (settled && status !== "CLOSED") {
    await setLoanStatus(loanId, "CLOSED");
    return "CLOSED";
  }
  if (!settled && status === "CLOSED") {
    await setLoanStatus(loanId, "ACTIVE");
    // Reopened: post any month-end interest the closed stretch skipped.
    await syncMissingMonthEndJournals(loanId);
    return "ACTIVE";
  }
  return status;
}
