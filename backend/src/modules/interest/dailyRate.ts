import { InterestBasis } from "./interest.types";

/**
 * Per-day rate fraction for bases that support day-by-day accrual — used by
 * the Running Balance Method's daily walk. FULL_MONTH and CUSTOM have no
 * sensible daily-rate concept and must be rejected before reaching here
 * (see interest.validators.ts's RUNNING_BALANCE + basis check).
 */
export function getDailyRateFraction(basis: InterestBasis, annualRate: number): number {
  switch (basis) {
    case "ACTUAL_365":
      return annualRate / 100 / 365;
    case "ACTUAL_360":
      return annualRate / 100 / 360;
    case "MONTHLY_RATE_ACTUAL_30":
      return annualRate / 12 / 100 / 30;
    case "FIXED_MONTHLY":
      // Flat monthly % spread evenly across a 30-day month.
      return annualRate / 100 / 30;
    case "THIRTY_360":
    case "MONTHLY":
      // Retired from selection for new configs, kept computable for any
      // pre-existing config that still references them.
      return annualRate / 100 / 30;
    case "FULL_MONTH":
    case "CUSTOM":
      throw new Error(`Running Balance Method does not support interest basis: ${basis}`);
    default:
      throw new Error(`Unknown interest basis: ${basis}`);
  }
}
