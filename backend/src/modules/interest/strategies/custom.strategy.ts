import { evaluate } from "mathjs";
import { InterestStrategy, InterestCalculationInput } from "../interest.types";
import { diffInDays } from "../../../common/date-utils";

/**
 * SRS Option 7: Custom Formula
 *
 * Admin supplies a formula string (e.g. "principal * rate / 100 * days / 360"),
 * stored in interestConfigs.customFormula, evaluated safely via mathjs —
 * NOT raw eval(). Only the three named variables below are exposed to the
 * formula; it has no access to the database, filesystem, or anything
 * outside this calculation scope.
 */
export function evaluateCustomFormula(
  formula: string,
  input: InterestCalculationInput
): number {
  const days = diffInDays(input.periodStart, input.periodEnd);

  const scope = {
    principal: input.principal,
    rate: input.annualRate,
    days,
  };

  let result: unknown;
  try {
    result = evaluate(formula, scope);
  } catch (err) {
    throw new Error(
      `Failed to evaluate custom interest formula "${formula}": ${(err as Error).message}`
    );
  }

  if (typeof result !== "number" || Number.isNaN(result)) {
    throw new Error(
      `Custom interest formula "${formula}" did not evaluate to a valid number.`
    );
  }

  return result;
}

/**
 * Registry-compatible placeholder. The standard InterestStrategy interface
 * only receives principal/rate/dates — it has no slot for a formula string.
 * interest.service.ts detects CUSTOM basis and calls evaluateCustomFormula()
 * directly with the loan's stored customFormula, bypassing this registry
 * entry entirely. This throws only if something calls it via the normal
 * registry path by mistake.
 */
export const customStrategy: InterestStrategy = {
  calculate(_input: InterestCalculationInput): number {
    throw new Error(
      "CUSTOM interest basis requires a formula string — interest.service.ts must call evaluateCustomFormula() directly, not the standard strategy registry."
    );
  },
};