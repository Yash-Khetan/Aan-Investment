import { InterestStrategy, InterestCalculationInput } from "../interest.types";

// SRS Option 6: Full Month Interest on Disbursement
// Example: disbursement on 20th January -> entire January interest charged.
// Treated as one full month's interest regardless of actual disbursement day.
export const fullMonthStrategy: InterestStrategy = {
  calculate({ principal, annualRate }: InterestCalculationInput): number {
    return principal * (annualRate / 100 / 12);
  },
};