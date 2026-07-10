import {
  getCurrentInterestConfig,
  getInterestRulesForConfig,
  getCurrentPenalRule,
} from "./interest.repository";
import { interestStrategyRegistry } from "./strategies";
import { resolveEffectiveRate } from "./rateResolver";
import { calculatePenalInterest } from "./penalInterest.service";
import { detectActiveEvents } from "./eventDetector";
import { InstallmentSnapshot } from "./eventDetector.types";
import { InterestRuleRow } from "./interest.types";
import { PenalInterestRuleRow } from "./penalInterest.types";

export interface CalculateInterestInput {
  loanId: string;
  asOfDate: Date;
  loanDisbursementDate: Date;
  outstandingPrincipal: number;
  overdueInstallmentAmount: number;
  installments: InstallmentSnapshot[];
  wasExtended: boolean;
  daysLate: number;
}

export interface CalculateInterestResult {
  baseInterest: number;
  effectiveRate: number;
  rateSource: "BASE_RATE" | "TIME_SLAB" | "EVENT_TRIGGERED";
  penalty: number;
  penaltyApplied: boolean;
  totalInterest: number;
}

function diffInMonths(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

/**
 * Orchestrates the full interest calculation for a loan as of a given date:
 * 1. Load the current interest config + its slab/event rules.
 * 2. Detect which events are currently active for the loan.
 * 3. Resolve the effective rate (config base vs slabs vs events, highest wins).
 * 4. Run the appropriate calculation strategy for the configured basis.
 * 5. Layer on penal interest if the loan is late beyond its grace period.
 */
export async function calculateInterestForLoan(
  input: CalculateInterestInput
): Promise<CalculateInterestResult> {
  const config = await getCurrentInterestConfig(input.loanId);

  if (!config) {
    throw new Error(`No current interest config found for loan ${input.loanId}`);
  }

  const ruleRows = await getInterestRulesForConfig(config.id);
  const rules: InterestRuleRow[] = ruleRows.map((r) => ({
    id: r.id,
    interestConfigId: r.interestConfigId,
    fromMonth: r.fromMonth,
    toMonth: r.toMonth,
    rate: r.rate,
    triggerEvent: r.triggerEvent,
  }));

  const activeEvents = detectActiveEvents({
    asOfDate: input.asOfDate,
    installments: input.installments,
    wasExtended: input.wasExtended,
  });

  const loanAgeInMonths = diffInMonths(input.loanDisbursementDate, input.asOfDate);

  const { rate: effectiveRate, reason: rateSource } = resolveEffectiveRate({
    baseRate: Number(config.annualRate),
    rules,
    loanAgeInMonths,
    activeEvents,
  });

  const strategy = interestStrategyRegistry[config.interestBasis as keyof typeof interestStrategyRegistry];
  if (!strategy) {
    throw new Error(`No strategy registered for interest basis: ${config.interestBasis}`);
  }

  const baseInterest = strategy.calculate({
    principal: input.outstandingPrincipal,
    annualRate: effectiveRate,
    periodStart: new Date(config.effectiveFrom),
    periodEnd: input.asOfDate,
  });

  const penalRuleRow = await getCurrentPenalRule(input.loanId);

  let penalty = 0;
  let penaltyApplied = false;

  if (penalRuleRow) {
    const penalRule: PenalInterestRuleRow = {
      id: penalRuleRow.id,
      loanId: penalRuleRow.loanId,
      penalType: penalRuleRow.penalType,
      penalRate: penalRuleRow.penalRate,
      penalAmount: penalRuleRow.penalAmount,
      penalBase: penalRuleRow.penalBase ?? "OVERDUE_INSTALLMENT_ONLY",
      gracePeriodDays: penalRuleRow.gracePeriodDays ?? 0,
    };

    const penalResult = calculatePenalInterest({
      rule: penalRule,
      daysLate: input.daysLate,
      outstandingPrincipal: input.outstandingPrincipal,
      overdueInstallmentAmount: input.overdueInstallmentAmount,
    });

    penalty = penalResult.penaltyAmount;
    penaltyApplied = penalResult.applied;
  }

  return {
    baseInterest,
    effectiveRate,
    rateSource,
    penalty,
    penaltyApplied,
    totalInterest: baseInterest + penalty,
  };
}