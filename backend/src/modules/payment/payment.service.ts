import { getCurrentWaterfallSteps, createPaymentWithAllocation } from "./payment.repository";
import { applyWaterfall } from "./waterfallEngine";
import { WaterfallStep } from "./payment.types";

const DEFAULT_ORDER: WaterfallStep[] = ["PENALTY", "INTEREST", "PRINCIPAL"];

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
}) {
  const waterfall = await getCurrentWaterfallSteps(input.loanId);

  const order: WaterfallStep[] = waterfall
    ? (waterfall.steps.map((s) => s.bucketType) as WaterfallStep[])
    : DEFAULT_ORDER;

  const result = applyWaterfall(order, {
    paymentAmount: input.amount,
    outstandingPenalty: input.outstandingPenalty,
    outstandingInterest: input.outstandingInterest,
    outstandingPrincipal: input.outstandingPrincipal,
  });

  const saved = await createPaymentWithAllocation({
    loanId: input.loanId,
    paymentRefNumber: input.paymentRefNumber,
    amount: input.amount,
    paymentDate: input.paymentDate,
    paymentMode: input.paymentMode,
    transactionRef: input.transactionRef,
    receivedBy: input.receivedBy,
    remarks: input.remarks,
    installmentId: input.installmentId,
    penaltyApplied: result.penaltyApplied,
    interestApplied: result.interestApplied,
    principalApplied: result.principalApplied,
  });

  return { ...saved, waterfallResult: result };
}