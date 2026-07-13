import { eq, and, asc } from "drizzle-orm";
import {
  db,
  payments,
  paymentAllocations,
  paymentWaterfallConfigs,
  paymentWaterfallSteps,
  installments,
} from "../../db";

export async function getCurrentWaterfallSteps(loanId: string) {
  const config = await db
    .select()
    .from(paymentWaterfallConfigs)
    .where(and(eq(paymentWaterfallConfigs.loanId, loanId), eq(paymentWaterfallConfigs.isCurrent, true)))
    .limit(1);

  if (!config[0]) return null;

  const steps = await db
    .select()
    .from(paymentWaterfallSteps)
    .where(eq(paymentWaterfallSteps.waterfallConfigId, config[0].id))
    .orderBy(asc(paymentWaterfallSteps.stepOrder));

  return { config: config[0], steps };
}

export async function createPaymentWithAllocation(input: {
  loanId: string;
  paymentRefNumber: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  transactionRef?: string;
  receivedBy?: string;
  remarks?: string;
  installmentId?: string;
  penaltyApplied: number;
  interestApplied: number;
  principalApplied: number;
}) {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .insert(payments)
      .values({
        paymentRefNumber: input.paymentRefNumber,
        loanId: input.loanId,
        amount: String(input.amount),
        paymentDate: input.paymentDate,
        paymentMode: input.paymentMode as any,
        status: "SUCCESS",
        transactionRef: input.transactionRef,
        receivedBy: input.receivedBy,
        remarks: input.remarks,
      })
      .returning();
      if (!payment) {
      throw new Error("Failed to create payment record.");
    }

    const [allocation] = await tx
      .insert(paymentAllocations)
      .values({
        paymentId: payment.id,
        installmentId: input.installmentId,
        principalApplied: String(input.principalApplied),
        interestApplied: String(input.interestApplied),
        penalInterestApplied: String(input.penaltyApplied),
        otherCharges: "0",
      })
      .returning();

    if (input.installmentId) {
      const [inst] = await tx
        .select()
        .from(installments)
        .where(eq(installments.id, input.installmentId))
        .limit(1);

      if (inst) {
        const newPaidPrincipal = Number(inst.paidPrincipal ?? 0) + input.principalApplied;
        const newPaidInterest = Number(inst.paidInterest ?? 0) + input.interestApplied;
        const newPaidTotal = newPaidPrincipal + newPaidInterest;
        const totalDue = Number(inst.totalAmount ?? 0);

        await tx
          .update(installments)
          .set({
            paidPrincipal: String(newPaidPrincipal),
            paidInterest: String(newPaidInterest),
            paidTotal: String(newPaidTotal),
            status: newPaidTotal >= totalDue ? "SUCCESS" : "PARTIAL",
            paidDate: input.paymentDate,
          })
          .where(eq(installments.id, input.installmentId));
      }
    }

    return { payment, allocation };
  });
}

export async function getPaymentsForLoan(loanId: string) {
  const { eq, desc } = await import("drizzle-orm");
  return db.select().from(payments).where(eq(payments.loanId, loanId)).orderBy(desc(payments.paymentDate));
}