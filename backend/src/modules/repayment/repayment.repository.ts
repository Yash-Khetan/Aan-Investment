import { eq, and, desc, gt, sql } from "drizzle-orm";
import { db, repaymentSchedules, installments, paymentAllocations, loans } from "../../db";
import { GeneratedInstallment } from "./repayment.types";

/**
 * Fetches the currently active repayment schedule for a loan.
 */
export async function getCurrentSchedule(loanId: string) {
  const rows = await db
    .select()
    .from(repaymentSchedules)
    .where(and(eq(repaymentSchedules.loanId, loanId), eq(repaymentSchedules.isCurrent, true)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Fetches all installments belonging to a given schedule, ordered by
 * installment number.
 */
export async function getInstallmentsForSchedule(scheduleId: string) {
  return db
    .select({
      id: installments.id,
      scheduleId: installments.scheduleId,
      installmentNumber: installments.installmentNumber,
      dueDate: installments.dueDate,
      principalAmount: installments.principalAmount,
      interestAmount: installments.interestAmount,
      totalAmount: installments.totalAmount,
      outstandingBalance: installments.outstandingBalance,
      paidPrincipal: installments.paidPrincipal,
      paidInterest: installments.paidInterest,
      paidTotal: installments.paidTotal,
      status: installments.status,
      paidDate: installments.paidDate,
      penaltyPaid: sql<string>`coalesce(sum(${paymentAllocations.penalInterestApplied}), 0)`,
    })
    .from(installments)
    .leftJoin(paymentAllocations, eq(paymentAllocations.installmentId, installments.id))
    .where(eq(installments.scheduleId, scheduleId))
    .groupBy(installments.id)
    .orderBy(installments.installmentNumber);
}

/**
 * Returns the next version number for a loan's schedule history
 * (1 if no schedule exists yet).
 */
export async function getNextVersionNumber(loanId: string): Promise<number> {
  const rows = await db
    .select({ version: repaymentSchedules.version })
    .from(repaymentSchedules)
    .where(eq(repaymentSchedules.loanId, loanId))
    .orderBy(desc(repaymentSchedules.version))
    .limit(1);

  return (rows[0]?.version ?? 0) + 1;
}

/**
 * Creates a new repayment schedule version for a loan, inserting its
 * generated installments, and marking any previous schedule as no
 * longer current. Old schedules + their installments are NEVER deleted —
 * they remain in the DB for audit (per SRS: "Old schedules remain stored
 * for audit").
 *
 * Runs as a single transaction: superseding the old schedule and creating
 * the new one + installments must succeed or fail together.
 */
export async function createScheduleRevision(input: {
  loanId: string;
  generatedInstallments: GeneratedInstallment[];
  remarks?: string;
  generationSnapshot: {
    principal: number;
    annualRate: number;
    interestBasis: string;
    calculationMethod: string;
    tenureMonths: number;
    disbursementDate: Date;
  };
}) {
  return db.transaction(async (tx) => {
    const previous = await tx
      .select()
      .from(repaymentSchedules)
      .where(and(eq(repaymentSchedules.loanId, input.loanId), eq(repaymentSchedules.isCurrent, true)))
      .limit(1);

    if (previous[0]) {
      await tx
        .update(repaymentSchedules)
        .set({ isCurrent: false })
        .where(eq(repaymentSchedules.id, previous[0].id));
    }

    const nextVersion = (previous[0]?.version ?? 0) + 1;
    const snapshot = input.generationSnapshot;

    const [schedule] = await tx
      .insert(repaymentSchedules)
      .values({
        loanId: input.loanId,
        version: nextVersion,
        isCurrent: true,
        remarks: input.remarks,
        generatedPrincipal: String(snapshot.principal),
        generatedAnnualRate: String(snapshot.annualRate),
        generatedInterestBasis: snapshot.interestBasis as any,
        generatedCalculationMethod: snapshot.calculationMethod as any,
        generatedTenureMonths: snapshot.tenureMonths,
        generatedDisbursementDate: snapshot.disbursementDate.toISOString().slice(0, 10),
      })
      .returning();
      if (!schedule) {
      throw new Error("Failed to create repayment schedule.");
    }

    if (input.generatedInstallments.length > 0) {
      await tx.insert(installments).values(
        input.generatedInstallments.map((inst) => ({
          scheduleId: schedule.id,
          installmentNumber: inst.installmentNumber,
          dueDate: inst.dueDate.toISOString().slice(0, 10),
          principalAmount: String(inst.principalAmount),
          interestAmount: String(inst.interestAmount),
          totalAmount: String(inst.totalAmount),
          outstandingBalance: String(inst.outstandingBalance),
        }))
      );
    }

    return schedule;
  });
}

/** Loan fields needed to auto-generate a schedule and detect staleness. */
export async function getLoanForSchedule(loanId: string) {
  const rows = await db
    .select({
      id: loans.id,
      disbursedAmount: loans.disbursedAmount,
      sanctionedAmount: loans.sanctionedAmount,
      repaymentType: loans.repaymentType,
      moratoriumMonths: loans.moratoriumMonths,
      firstDisbursementDate: loans.firstDisbursementDate,
      maturityDate: loans.maturityDate,
    })
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);

  return rows[0] ?? null;
}

/** Whether any installment under this schedule has ever received a payment. */
export async function hasPaymentsAgainstSchedule(scheduleId: string): Promise<boolean> {
  const rows = await db
    .select({ id: installments.id })
    .from(installments)
    .where(and(eq(installments.scheduleId, scheduleId), gt(installments.paidTotal, "0")))
    .limit(1);

  return rows.length > 0;
}