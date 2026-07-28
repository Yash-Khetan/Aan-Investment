import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "../../db/index";
import { installments, loans, repaymentSchedules } from "../../db/schema";

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

export interface LoanOverdueMetrics {
    amountOverdue: number;
    dpd: number;
    classification: LoanClassification;
    nextDueDate: string | null;
}

const toDate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00Z`);

/** Whole days between two YYYY-MM-DD dates (positive when `to` is after `from`). */
const daysBetween = (from: string, to: string): number =>
    Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);

/**
 * Overdue/DPD/classification/next-due-date for each loan, computed from its
 * *current* repayment schedule's unpaid installments.
 *   - amountOverdue: sum of (expected - paid) for installments past due and unpaid.
 *   - dpd: days since the OLDEST unpaid overdue installment's due date (the
 *     standard NPA-classification basis) — 0 when nothing is overdue.
 *   - nextDueDate: earliest due date among unpaid installments (overdue or upcoming).
 * Loans with no installments (e.g. schedule not yet generated) are absent from
 * the returned map — callers should treat that as "no metrics" (STD, 0 overdue).
 */
export async function getOverdueMetrics(
    loanIds: string[],
): Promise<Map<string, LoanOverdueMetrics>> {
    const map = new Map<string, LoanOverdueMetrics>();
    if (loanIds.length === 0) return map;

    const today = new Date().toISOString().slice(0, 10);

    const rows = await db
        .select({
            loanId: repaymentSchedules.loanId,
            amountOverdue: sql<string>`coalesce(sum(${installments.totalAmount} - ${installments.paidTotal}) filter (where ${installments.status} in ('PENDING','PARTIAL') and ${installments.dueDate} < current_date), 0)`,
            oldestOverdueDueDate: sql<string | null>`min(${installments.dueDate}) filter (where ${installments.status} in ('PENDING','PARTIAL') and ${installments.dueDate} < current_date)`,
            nextDueDate: sql<string | null>`min(${installments.dueDate}) filter (where ${installments.status} in ('PENDING','PARTIAL'))`,
        })
        .from(installments)
        .innerJoin(
            repaymentSchedules,
            eq(installments.scheduleId, repaymentSchedules.id),
        )
        .where(
            and(
                inArray(repaymentSchedules.loanId, loanIds),
                eq(repaymentSchedules.isCurrent, true),
                isNull(installments.deletedAt),
            ),
        )
        .groupBy(repaymentSchedules.loanId);

    for (const row of rows) {
        const dpd = row.oldestOverdueDueDate
            ? daysBetween(row.oldestOverdueDueDate, today)
            : 0;

        map.set(row.loanId, {
            amountOverdue: Number(row.amountOverdue),
            dpd,
            classification: classifyByDpd(dpd),
            nextDueDate: row.nextDueDate,
        });
    }

    return map;
}

/** Metrics for a loan absent from the map (no installments yet, or none overdue). */
export const EMPTY_METRICS: LoanOverdueMetrics = {
    amountOverdue: 0,
    dpd: 0,
    classification: "STD",
    nextDueDate: null,
};

/**
 * Outstanding principal = disbursedAmount - principal actually paid off, per
 * the loan's *current* repayment schedule. This is the ground truth: nothing
 * writes to `loans.outstandingPrincipal` when a payment is recorded (see
 * `backend/src/modules/reports/README.md`, which documents that column as a
 * manually-maintained value the caller is responsible for keeping in sync),
 * so that stored column silently drifts stale the moment any repayment comes
 * in. Every consumer that needs a *correct* outstanding balance (loan list/
 * detail, dashboard totals, IRR) should compute it here instead of trusting
 * the column.
 *
 * Loans with no repayment schedule yet fall back to the full disbursedAmount
 * (nothing has been paid off, so it's all still outstanding).
 */
export async function getOutstandingPrincipal(
    loanIds: string[],
): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (loanIds.length === 0) return map;

    const loanRows = await db
        .select({ id: loans.id, disbursedAmount: loans.disbursedAmount })
        .from(loans)
        .where(inArray(loans.id, loanIds));

    const paidRows = await db
        .select({
            loanId: repaymentSchedules.loanId,
            paidPrincipal: sql<string>`coalesce(sum(${installments.paidPrincipal}), 0)`,
        })
        .from(installments)
        .innerJoin(
            repaymentSchedules,
            eq(installments.scheduleId, repaymentSchedules.id),
        )
        .where(
            and(
                inArray(repaymentSchedules.loanId, loanIds),
                eq(repaymentSchedules.isCurrent, true),
                isNull(installments.deletedAt),
            ),
        )
        .groupBy(repaymentSchedules.loanId);

    const paidByLoan = new Map(paidRows.map((r) => [r.loanId, Number(r.paidPrincipal)]));

    for (const loan of loanRows) {
        const disbursed = Number(loan.disbursedAmount ?? 0);
        const paid = paidByLoan.get(loan.id) ?? 0;
        map.set(loan.id, Math.max(disbursed - paid, 0));
    }

    return map;
}
