import {
  PenalCalculationInput,
  PenalCalculationResult,
} from "./penalInterest.types";

/**
 * Calculates penal interest for a late payment, per SRS rules:
 * - Penalty can be percentage-based or a fixed amount.
 * - Percentage applies either to the entire outstanding principal,
 *   or only to the overdue installment amount (per `penalBase`).
 * - Grace period: penalty applies only once daysLate STRICTLY exceeds
 *   gracePeriodDays. Exactly gracePeriodDays late is still protected.
 */
export function calculatePenalInterest(
  input: PenalCalculationInput
): PenalCalculationResult {
  const { rule, daysLate, outstandingPrincipal, overdueInstallmentAmount } = input;

  if (daysLate <= 0) {
    return { penaltyAmount: 0, applied: false, reason: "NOT_LATE" };
  }

  if (daysLate <= rule.gracePeriodDays) {
    return { penaltyAmount: 0, applied: false, reason: "WITHIN_GRACE_PERIOD" };
  }

  const base =
    rule.penalBase === "ENTIRE_OUTSTANDING"
      ? outstandingPrincipal
      : overdueInstallmentAmount;

  let penaltyAmount: number;

  if (rule.penalType === "FIXED_AMOUNT") {
    penaltyAmount = Number(rule.penalAmount ?? 0);
  } else {
    const rate = Number(rule.penalRate ?? 0);
    penaltyAmount = base * (rate / 100);
  }

  return { penaltyAmount, applied: true, reason: "APPLIED" };
}