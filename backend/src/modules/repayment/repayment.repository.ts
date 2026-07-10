import { eq, and, desc } from "drizzle-orm";
import { db, repaymentSchedules, installments } from "../../db";
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
    .select()
    .from(installments)
    .where(eq(installments.scheduleId, scheduleId))
    .orderBy(installments.installmentNumber);
}

/**
 * Returns the next version number for a loan's schedule history
 * (1 if no schedule exists yet).
 */
async function getNextVersionNumber(loanId: string): Promise<number> {
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

    const [schedule] = await tx
      .insert(repaymentSchedules)
      .values({
        loanId: input.loanId,
        version: nextVersion,
        isCurrent: true,
        remarks: input.remarks,
      })
      .returning();

    if (input.generatedInstallments.length > 0) {
      await tx.insert(installments).values(
        input.generatedInstallments.map((inst) => ({
          scheduleId: schedule.id,
          installmentNumber: inst.installmentNumber,
          dueDate: inst.dueDate.toISOString().slice(0, 10),
          principalAmount: String(inst.principalAmount),
          interestAmount: String(inst.interestAmount),
          totalAmount: String(inst.totalAmount),
        }))
      );
    }

    return schedule;
  });
}