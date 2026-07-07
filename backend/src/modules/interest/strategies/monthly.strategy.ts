import { InterestStrategy, InterestCalculationInput } from "../interest.types";

// SRS Option 4: Monthly Basis
// Interest for one month irrespective of number of days
export const monthlyStrategy: InterestStrategy = {
  calculate({ principal, annualRate }: InterestCalculationInput): number {
    return principal * (annualRate / 100 / 12);
  },
};