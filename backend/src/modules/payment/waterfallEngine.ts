import { WaterfallStep, WaterfallInput, WaterfallResult } from "./payment.types";

/**
 * Applies a payment across buckets in the given step order, exhausting
 * each bucket before moving to the next. SPECIFIC_TRANCHE steps are
 * treated as a no-op here (0 applied) since tranche-level payment
 * application isn't implemented in V1 — the step is skipped safely
 * rather than throwing, so a config containing it doesn't break payments.
 */
export function applyWaterfall(
  order: WaterfallStep[],
  input: WaterfallInput
): WaterfallResult {
  let remaining = input.paymentAmount;

  const outstanding: Record<Exclude<WaterfallStep, "SPECIFIC_TRANCHE">, number> = {
    PENALTY: input.outstandingPenalty,
    INTEREST: input.outstandingInterest,
    PRINCIPAL: input.outstandingPrincipal,
  };

  const applied = { PENALTY: 0, INTEREST: 0, PRINCIPAL: 0 };

  for (const step of order) {
    if (remaining <= 0) break;
    if (step === "SPECIFIC_TRANCHE") continue;

    const amountForStep = Math.min(remaining, outstanding[step]);
    applied[step] = round2(amountForStep);
    remaining -= amountForStep;
  }

  return {
    penaltyApplied: applied.PENALTY,
    interestApplied: applied.INTEREST,
    principalApplied: applied.PRINCIPAL,
    unallocated: round2(remaining),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}