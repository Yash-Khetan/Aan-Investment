/**
 * A loan's interest configuration — entered on the loan form, stored as an
 * effective-dated revision, and what its ledger accrues at every month-end.
 */

/** Day-count bases the ledger's daily running-balance walk supports. */
export const INTEREST_BASIS_OPTIONS = [
  { value: "ACTUAL_365", label: "Actual Days / 365" },
  { value: "ACTUAL_360", label: "Actual Days / 360" },
  { value: "MONTHLY_RATE_ACTUAL_30", label: "Monthly Rate × Actual Days / 30" },
  { value: "FIXED_MONTHLY", label: "Fixed Monthly Interest" },
] as const;

export type InterestBasis = (typeof INTEREST_BASIS_OPTIONS)[number]["value"];

export const INCLUDE_OPENING_CLOSING_DAYS_OPTIONS = [
  { value: false, label: "No" },
  { value: true, label: "Yes" },
] as const;

export interface InterestConfig {
  id: string;
  loanId: string;
  annualRate: string;
  tdsRatePercent: string;
  interestBasis: InterestBasis;
  effectiveFrom: string;
  effectiveTo: string | null;
  isCurrent: boolean;
  remarks: string | null;
  includeOpeningClosingDays: boolean;
  createdAt: string;
  updatedAt: string;
}
