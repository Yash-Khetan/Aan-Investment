import { InterestStrategy, InterestCalculationInput } from "../interest.types";

// SRS Option 5: Fixed Monthly Interest
// Example: 2% per month flat, regardless of annualRate math -
// here annualRate is treated as the flat monthly % directly.
export const fixedMonthlyStrategy: InterestStrategy = {
  calculate({ principal, annualRate }: InterestCalculationInput): number {
    return principal * (annualRate / 100);
  },
};