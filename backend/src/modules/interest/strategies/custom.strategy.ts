import { InterestStrategy, InterestCalculationInput } from "../interest.types";

// SRS Option 7: Custom Formula
// Placeholder for admin-configured formulas. For V1, throws until
// a formula-evaluation mechanism (e.g. stored expression + safe evaluator)
// is designed. Do not silently fall back to another basis.
export const customStrategy: InterestStrategy = {
  calculate(_input: InterestCalculationInput): number {
    throw new Error(
      "CUSTOM interest basis has no formula evaluator configured yet."
    );
  },
};