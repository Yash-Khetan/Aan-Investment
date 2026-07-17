import {
  EffectiveRateInput,
  EffectiveRateResult,
  InterestRuleRow,
} from "./interest.types";

/**
 * Determines the effective interest rate for a loan at a point in time,
 * by layering step-up/step-down slabs and event-based triggers on top
 * of the base rate from interestConfigs.
 *
 * Conflict rule: if multiple rules apply simultaneously (a time slab AND
 * a triggered event), the HIGHEST rate wins. This guarantees a triggered
 * penalty/event can never silently undercut a scheduled step-up rate.
 */
export function resolveEffectiveRate(
  input: EffectiveRateInput
): EffectiveRateResult {
  const { baseRate, rules, loanAgeInMonths, activeEvents } = input;

  let best: EffectiveRateResult = {
    rate: baseRate,
    appliedRuleId: null,
    reason: "BASE_RATE",
  };

  for (const rule of rules) {
    const ruleRate = Number(rule.rate);

    if (isTimeSlabMatch(rule, loanAgeInMonths)) {
      if (ruleRate > best.rate) {
        best = { rate: ruleRate, appliedRuleId: rule.id, reason: "TIME_SLAB" };
      }
    }

    if (isEventMatch(rule, activeEvents)) {
      if (ruleRate > best.rate) {
        best = {
          rate: ruleRate,
          appliedRuleId: rule.id,
          reason: "EVENT_TRIGGERED",
        };
      }
    }
  }

  return best;
}

function isTimeSlabMatch(rule: InterestRuleRow, loanAgeInMonths: number): boolean {
  if (rule.fromMonth === null && rule.toMonth === null) return false;

  const from = rule.fromMonth ?? 0;
  const to = rule.toMonth ?? Infinity;

  return loanAgeInMonths >= from && loanAgeInMonths <= to;
}

function isEventMatch(rule: InterestRuleRow, activeEvents: string[]): boolean {
  if (!rule.triggerEvent) return false;
  return activeEvents.includes(rule.triggerEvent);
}