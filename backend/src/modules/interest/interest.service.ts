import {
  getCurrentInterestConfig,
  getInterestRulesForConfig,
  getCurrentPenalRule,
  getLoanOriginalPrincipal,
  getPrincipalLedgerEvents,
} from "./interest.repository";
import { interestStrategyRegistry } from "./strategies";
import { resolveEffectiveRate } from "./rateResolver";
import { calculatePenalInterest } from "./penalInterest.service";
import { detectActiveEvents } from "./eventDetector";
import { InstallmentSnapshot } from "./eventDetector.types";
import { InterestBasis, InterestRuleRow } from "./interest.types";
import { PenalInterestRuleRow } from "./penalInterest.types";
import { evaluateCustomFormula } from "./strategies/custom.strategy";
import { getDailyRateFraction } from "./dailyRate";
import { calculateRunningBalanceInterest } from "./runningBalance";

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
 * A single point-in-time interest calculation for one period — the shared
 * building block behind SIMPLE_INTEREST (used here) and the Repayment
 * Engine's per-installment interest (each installment is one such period,
 * fed either the loan's original principal or its own declining scheduled
 * balance depending on the config's calculation method).
 */
export function calculatePeriodInterest(input: {
  interestBasis: string;
  annualRate: number;
  periodStart: Date;
  periodEnd: Date;
  includeOpeningClosingDays: boolean;
  principal: number;
  customFormula?: string | null;
}): number {
  if (input.interestBasis === "CUSTOM") {
    if (!input.customFormula) {
      throw new Error("interestBasis is CUSTOM but no customFormula configured.");
    }

    return evaluateCustomFormula(input.customFormula, {
      principal: input.principal,
      annualRate: input.annualRate,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    });
  }

  const strategy = interestStrategyRegistry[input.interestBasis as keyof typeof interestStrategyRegistry];
  if (!strategy) {
    throw new Error(`No strategy registered for interest basis: ${input.interestBasis}`);
  }

  return strategy.calculate({
    principal: input.principal,
    annualRate: input.annualRate,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    includeOpeningClosingDays: input.includeOpeningClosingDays,
  });
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

  const periodStart = new Date(config.effectiveFrom);
  const includeOpeningClosingDays = config.includeOpeningClosingDays ?? false;
  let baseInterest: number;

  if (config.calculationMethod === "RUNNING_BALANCE") {
    // Validated at config-creation time, but re-checked here defensively
    // since a config's basis/method combination is fixed once saved.
    if (config.interestBasis === "FULL_MONTH" || config.interestBasis === "CUSTOM") {
      throw new Error(
        `Running Balance Method does not support interest basis ${config.interestBasis} for loan ${input.loanId}.`
      );
    }

    const events = await getPrincipalLedgerEvents(input.loanId);
    const dailyRate = getDailyRateFraction(config.interestBasis as InterestBasis, effectiveRate);

    baseInterest = calculateRunningBalanceInterest({
      events,
      periodStart,
      periodEnd: input.asOfDate,
      dailyRate,
      includeOpeningClosingDays,
    });
  } else {
    // SIMPLE_INTEREST — the loan's original principal (never reduced by
    // repayments), calculated as a single point-in-time formula. There is no
    // compounding path anywhere in this codebase, so "does not earn interest
    // on unpaid interest" already holds by construction.
    const originalPrincipal = await getLoanOriginalPrincipal(input.loanId);

    baseInterest = calculatePeriodInterest({
      interestBasis: config.interestBasis,
      annualRate: effectiveRate,
      periodStart,
      periodEnd: input.asOfDate,
      includeOpeningClosingDays,
      principal: originalPrincipal,
      customFormula: config.customFormula,
    });
  }

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