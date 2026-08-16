import { InterestStrategy, InterestCalculationInput } from "../interest.types";
import { diffInDays } from "../../../common/date-utils";

// Monthly Rate x Actual Days / 30 — the monthly-quoted rate (annualRate / 12)
// prorated by how many 30-day-months' worth of actual elapsed days there were.
// Standard NBFC convention for monthly-rate-quoted structured lending.
export const monthlyRateActual30Strategy: InterestStrategy = {
  calculate({ principal, annualRate, periodStart, periodEnd, includeOpeningClosingDays }: InterestCalculationInput): number {
    const days = diffInDays(periodStart, periodEnd, includeOpeningClosingDays);
    const monthlyRate = annualRate / 12 / 100;
    return principal * monthlyRate * (days / 30);
  },
};
