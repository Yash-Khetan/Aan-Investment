import { InterestStrategy, InterestCalculationInput } from "../interest.types";

// SRS Option 3: 30/360 Method - every month treated as 30 days
export const thirty360Strategy: InterestStrategy = {
  calculate({ principal, annualRate, periodStart, periodEnd }: InterestCalculationInput): number {
    const d1 = periodStart.getDate() === 31 ? 30 : periodStart.getDate();
    const d2 = periodEnd.getDate() === 31 && d1 === 30 ? 30 : periodEnd.getDate();

    const months =
      (periodEnd.getFullYear() - periodStart.getFullYear()) * 12 +
      (periodEnd.getMonth() - periodStart.getMonth());

    const days = months * 30 + (d2 - d1);

    return (principal * (annualRate / 100) * days) / 360;
  },
};