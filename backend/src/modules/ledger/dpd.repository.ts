import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  installments,
  loanDpdHistory,
  loans,
  paymentAllocations,
  payments,
  repaymentSchedules,
} from "../../db";
import { NotFoundError } from "../../common/errors";

export type DpdHistoryRow = typeof loanDpdHistory.$inferSelect;

/**
 * One payment obligation on the loan's current schedule, reduced to just what
 * DPD needs: when it fell due and how much had to be cleared.
 *
 * `totalAmount` is the whole installment (principal + interest) — the same
 * obligation `loan.metrics.ts` measures overdue against, so the DPD History
 * grid and the DPD already shown on the Loans page agree.
 */
export interface DpdObligation {
  installmentId: string;
  dueDate: string;
  totalAmount: number;
}

/**
 * One appropriation against an obligation, with the date the money actually
 * arrived. Read from `payment_allocations` rather than `installments.paidTotal`
 * on purpose: allocations are append-only and dated, so they can answer "how
 * much had been cleared as at 31 March" — a running total the mutable
 * paid* columns on the installment cannot reconstruct.
 *
 * Penal interest and other charges are excluded: they aren't part of
 * `totalAmount`, so counting them would clear an obligation that isn't paid.
 */
export interface DpdAllocation {
  installmentId: string;
  paymentDate: string;
  amount: number;
}

/** The loan's start date — the first month its DPD grid has any meaning for. */
export async function getLoanStartDate(loanId: string): Promise<string | null> {
  const rows = await db
    .select({
      firstDisbursementDate: loans.firstDisbursementDate,
      sanctionDate: loans.sanctionDate,
    })
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new NotFoundError(`Loan ${loanId} not found.`);
  }

  return row.firstDisbursementDate ?? row.sanctionDate ?? null;
}

/** Every obligation on the loan's CURRENT repayment schedule, oldest due first. */
export async function getObligations(loanId: string): Promise<DpdObligation[]> {
  const rows = await db
    .select({
      installmentId: installments.id,
      dueDate: installments.dueDate,
      totalAmount: installments.totalAmount,
    })
    .from(installments)
    .innerJoin(repaymentSchedules, eq(installments.scheduleId, repaymentSchedules.id))
    .where(
      and(
        eq(repaymentSchedules.loanId, loanId),
        eq(repaymentSchedules.isCurrent, true),
        isNull(installments.deletedAt)
      )
    )
    .orderBy(asc(installments.dueDate));

  return rows.map((r) => ({
    installmentId: r.installmentId,
    dueDate: r.dueDate,
    totalAmount: Number(r.totalAmount ?? 0),
  }));
}

/** Every dated appropriation against those obligations. */
export async function getAllocations(installmentIds: string[]): Promise<DpdAllocation[]> {
  if (installmentIds.length === 0) return [];

  const rows = await db
    .select({
      installmentId: paymentAllocations.installmentId,
      paymentDate: payments.paymentDate,
      principalApplied: paymentAllocations.principalApplied,
      interestApplied: paymentAllocations.interestApplied,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(inArray(paymentAllocations.installmentId, installmentIds));

  return rows
    .filter((r) => r.installmentId !== null)
    .map((r) => ({
      installmentId: r.installmentId as string,
      paymentDate: r.paymentDate,
      amount: Number(r.principalApplied ?? 0) + Number(r.interestApplied ?? 0),
    }));
}

/** Every frozen month already on record for this loan, oldest first. */
export async function getDpdHistory(loanId: string): Promise<DpdHistoryRow[]> {
  return db
    .select()
    .from(loanDpdHistory)
    .where(eq(loanDpdHistory.loanId, loanId))
    .orderBy(asc(loanDpdHistory.monthStart));
}

/**
 * Freezes one month's DPD. `onConflictDoNothing` is the whole guarantee: a
 * month already on record is never rewritten, so two concurrent ledger reads
 * racing the same back-fill can't produce a different answer for a month
 * that's already been answered.
 */
export async function insertDpdMonths(
  rows: Array<{
    loanId: string;
    monthStart: string;
    dpdDays: number;
    bucket: number;
    amountOverdue: number;
    oldestOverdueDueDate: string | null;
  }>
): Promise<void> {
  if (rows.length === 0) return;

  await db
    .insert(loanDpdHistory)
    .values(
      rows.map((r) => ({
        loanId: r.loanId,
        monthStart: r.monthStart,
        dpdDays: r.dpdDays,
        bucket: r.bucket,
        amountOverdue: String(r.amountOverdue),
        oldestOverdueDueDate: r.oldestOverdueDueDate,
      }))
    )
    .onConflictDoNothing({
      target: [loanDpdHistory.loanId, loanDpdHistory.monthStart],
    });
}
