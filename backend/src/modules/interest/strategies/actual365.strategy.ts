import { InterestStrategy, InterestCalculationInput } from "../interest.types";
import { diffInDays } from "../../../common/date-utils";

// SRS Option 1: Actual Number of Days / 365
// Interest = Principal x Rate x Actual Days / 365
export const actual365Strategy: InterestStrategy = {
  calculate({ principal, annualRate, periodStart, periodEnd, includeOpeningClosingDays }: InterestCalculationInput): number {
    const days = diffInDays(periodStart, periodEnd, includeOpeningClosingDays);
    return (principal * (annualRate / 100) * days) / 365;
  },
};