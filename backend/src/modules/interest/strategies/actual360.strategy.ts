import { InterestStrategy, InterestCalculationInput } from "../interest.types";
import { diffInDays } from "../../../common/date-utils";

// SRS Option 2: Actual Number of Days / 360
export const actual360Strategy: InterestStrategy = {
  calculate({ principal, annualRate, periodStart, periodEnd, includeOpeningClosingDays }: InterestCalculationInput): number {
    const days = diffInDays(periodStart, periodEnd, includeOpeningClosingDays);
    return (principal * (annualRate / 100) * days) / 360;
  },
};