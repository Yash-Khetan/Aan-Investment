import { eq, and, asc, desc, inArray } from "drizzle-orm";
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

export async function createPaymentWithAllocations(input: {
  loanId: string;
  paymentRefNumber: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  transactionRef?: string;
  receivedBy?: string;
  remarks?: string;
  allocations: Array<{
    installmentId?: string;
    penaltyApplied: number;
    interestApplied: number;
    principalApplied: number;
  }>;
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

    const allocations = [];

    for (const alloc of input.allocations) {
      const [allocation] = await tx
        .insert(paymentAllocations)
        .values({
          paymentId: payment.id,
          installmentId: alloc.installmentId,
          principalApplied: String(alloc.principalApplied),
          interestApplied: String(alloc.interestApplied),
          penalInterestApplied: String(alloc.penaltyApplied),
          otherCharges: "0",
        })
        .returning();
      allocations.push(allocation);

      if (alloc.installmentId) {
        const [inst] = await tx
          .select()
          .from(installments)
          .where(eq(installments.id, alloc.installmentId))
          .limit(1);

        if (inst) {
          // Round after every accumulation, not just at the end — money must never carry binary
          // floating-point noise (798.30 + 128.05 can land on 926.34999999999997 in JS), or an
          // installment that's genuinely fully paid can fail the `>= totalDue` check forever.
          const newPaidPrincipal = round2(Number(inst.paidPrincipal ?? 0) + alloc.principalApplied);
          const newPaidInterest = round2(Number(inst.paidInterest ?? 0) + alloc.interestApplied);
          const newPaidTotal = round2(newPaidPrincipal + newPaidInterest);
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
            .where(eq(installments.id, alloc.installmentId));
        }
      }
    }

    return { payment, allocations };
  });
}

/**
 * One row per payment (never duplicated by a join) — a payment can now have
 * multiple `payment_allocations` rows (one per installment it touched, via
 * overflow cascading), so each payment carries its own `allocations` array
 * rather than being flattened across a join.
 */
export async function getPaymentsForLoan(loanId: string) {
  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.loanId, loanId))
    .orderBy(desc(payments.paymentDate));

  if (paymentRows.length === 0) return [];

  const allocationRows = await db
    .select()
    .from(paymentAllocations)
    .where(
      inArray(
        paymentAllocations.paymentId,
        paymentRows.map((p) => p.id),
      ),
    );

  const allocationsByPayment = new Map<string, typeof allocationRows>();
  for (const allocation of allocationRows) {
    const existing = allocationsByPayment.get(allocation.paymentId) ?? [];
    existing.push(allocation);
    allocationsByPayment.set(allocation.paymentId, existing);
  }

  return paymentRows.map((payment) => ({
    ...payment,
    allocations: allocationsByPayment.get(payment.id) ?? [],
  }));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}