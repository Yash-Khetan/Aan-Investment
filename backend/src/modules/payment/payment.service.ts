import { getCurrentWaterfallSteps, createPaymentWithAllocations, getPaymentsForLoan } from "./payment.repository";
import { getCurrentSchedule, getInstallmentsForSchedule } from "../repayment/repayment.repository";
import { applyWaterfall } from "./waterfallEngine";
import { WaterfallStep } from "./payment.types";
import { recordPaymentEntries } from "../accounting/accounting.service";

const DEFAULT_ORDER: WaterfallStep[] = ["PENALTY", "INTEREST", "PRINCIPAL"];

interface AllocationInput {
  installmentId?: string;
  principalApplied: number;
  interestApplied: number;
  penaltyApplied: number;
}

export async function recordPayment(input: {
  loanId: string;
  paymentRefNumber: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  transactionRef?: string;
  receivedBy?: string;
  remarks?: string;
  installmentId?: string;
  outstandingPenalty: number;
  outstandingInterest: number;
  outstandingPrincipal: number;
  autoApplyOverflow?: boolean;
}) {
  const waterfall = await getCurrentWaterfallSteps(input.loanId);
  const order: WaterfallStep[] = waterfall
    ? (waterfall.steps.map((s) => s.bucketType) as WaterfallStep[])
    : DEFAULT_ORDER;

  const firstResult = applyWaterfall(order, {
    paymentAmount: input.amount,
    outstandingPenalty: input.outstandingPenalty,
    outstandingInterest: input.outstandingInterest,
    outstandingPrincipal: input.outstandingPrincipal,
  });

  const allocations: AllocationInput[] = [
    {
      installmentId: input.installmentId,
      principalApplied: firstResult.principalApplied,
      interestApplied: firstResult.interestApplied,
      penaltyApplied: firstResult.penaltyApplied,
    },
  ];

  const installmentsSettled: Array<{
    installmentId: string;
    installmentNumber: number;
    principalApplied: number;
    interestApplied: number;
  }> = [];

  let remaining = firstResult.unallocated;

  // Cascade any leftover amount into the loan's next PENDING/PARTIAL installments (in due order),
  // only when the caller explicitly confirmed it (the leftover money would otherwise go untracked —
  // it's never applied automatically without confirmation, since that's a real allocation decision).
  if (input.installmentId && remaining > 0 && input.autoApplyOverflow) {
    const schedule = await getCurrentSchedule(input.loanId);

    if (schedule) {
      const allInstallments = await getInstallmentsForSchedule(schedule.id);
      const current = allInstallments.find((i) => i.id === input.installmentId);

      const next = allInstallments
        .filter((i) => i.id !== input.installmentId)
        .filter((i) => i.status === "PENDING" || i.status === "PARTIAL")
        .filter((i) => !current || i.installmentNumber > current.installmentNumber)
        .sort((a, b) => a.installmentNumber - b.installmentNumber);

      for (const inst of next) {
        if (remaining <= 0) break;

        const outstandingPrincipal = Number(inst.principalAmount) - Number(inst.paidPrincipal);
        const outstandingInterest = Number(inst.interestAmount) - Number(inst.paidInterest);

        const stepResult = applyWaterfall(order, {
          paymentAmount: remaining,
          outstandingPenalty: 0,
          outstandingInterest,
          outstandingPrincipal,
        });

        if (stepResult.principalApplied > 0 || stepResult.interestApplied > 0) {
          allocations.push({
            installmentId: inst.id,
            principalApplied: stepResult.principalApplied,
            interestApplied: stepResult.interestApplied,
            penaltyApplied: 0,
          });
          installmentsSettled.push({
            installmentId: inst.id,
            installmentNumber: inst.installmentNumber,
            principalApplied: stepResult.principalApplied,
            interestApplied: stepResult.interestApplied,
          });
        }

        remaining = stepResult.unallocated;
      }
    }
  }

  const saved = await createPaymentWithAllocations({
    loanId: input.loanId,
    paymentRefNumber: input.paymentRefNumber,
    amount: input.amount,
    paymentDate: input.paymentDate,
    paymentMode: input.paymentMode,
    transactionRef: input.transactionRef,
    receivedBy: input.receivedBy,
    remarks: input.remarks,
    allocations,
  });

  if (!saved.payment) {
    throw new Error("Payment creation did not return a payment record.");
  }

  const totalPrincipalApplied = allocations.reduce((sum, a) => sum + a.principalApplied, 0);
  const totalInterestApplied = allocations.reduce((sum, a) => sum + a.interestApplied, 0);
  const totalPenaltyApplied = allocations.reduce((sum, a) => sum + a.penaltyApplied, 0);

  await recordPaymentEntries({
    loanId: input.loanId,
    paymentId: saved.payment.id,
    entryDate: input.paymentDate,
    principalApplied: totalPrincipalApplied,
    interestApplied: totalInterestApplied,
    penaltyApplied: totalPenaltyApplied,
  });

  return {
    ...saved,
    waterfallResult: {
      penaltyApplied: totalPenaltyApplied,
      interestApplied: totalInterestApplied,
      principalApplied: totalPrincipalApplied,
      unallocated: remaining,
    },
    installmentsSettled,
  };
}

export async function getLoanPaymentHistory(loanId: string) {
  return getPaymentsForLoan(loanId);
}
