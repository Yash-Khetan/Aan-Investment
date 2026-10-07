import { InterestBasis } from "./interest.types";

/**
 * Per-day rate fraction for each day-count basis — used by the Running
 * Balance Method's daily walk (runningBalance.ts), which the ledger runs at
 * every month-end.
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
    default:
      throw new Error(`Unknown interest basis: ${basis as string}`);
  }
}
