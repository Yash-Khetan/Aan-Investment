// THIRTY_360 and MONTHLY are retired — no longer offered here. The backend
// still accepts them for any pre-existing config that used one.
export const INTEREST_BASIS_OPTIONS = [
  { value: "ACTUAL_365", label: "Actual Days / 365" },
  { value: "ACTUAL_360", label: "Actual Days / 360" },
  { value: "MONTHLY_RATE_ACTUAL_30", label: "Monthly Rate × Actual Days / 30" },
  { value: "FIXED_MONTHLY", label: "Fixed Monthly Interest" },
  { value: "FULL_MONTH", label: "Full Month Interest on Disbursement" },
  { value: "CUSTOM", label: "Customized Formula" },
] as const;

export type InterestBasis = (typeof INTEREST_BASIS_OPTIONS)[number]["value"];

export const INCLUDE_OPENING_CLOSING_DAYS_OPTIONS = [
  { value: false, label: "No" },
  { value: true, label: "Yes" },
] as const;

export const CALCULATION_METHOD_OPTIONS = [
  { value: "SIMPLE_INTEREST", label: "Simple Interest Method" },
  { value: "RUNNING_BALANCE", label: "Running Balance Method" },
] as const;

export type CalculationMethod = (typeof CALCULATION_METHOD_OPTIONS)[number]["value"];

/** Running Balance Method has no daily-rate concept for these two bases — block them client-side too. */
export const RUNNING_BALANCE_UNSUPPORTED_BASES: readonly InterestBasis[] = ["FULL_MONTH", "CUSTOM"];

export const INTEREST_RULE_TYPES = ["NORMAL", "STEP_UP", "STEP_DOWN", "EVENT_BASED", "CUSTOM"] as const;

export type InterestRuleType = (typeof INTEREST_RULE_TYPES)[number];

export interface InterestConfig {
  id: string;
  loanId: string;
  annualRate: string;
  interestBasis: InterestBasis;
  ruleType: InterestRuleType;
  effectiveFrom: string;
  effectiveTo: string | null;
  isCurrent: boolean;
  remarks: string | null;
  customFormula: string | null;
  includeOpeningClosingDays: boolean;
  calculationMethod: CalculationMethod;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInterestConfigInput {
  loanId: string;
  annualRate: number;
  interestBasis: InterestBasis;
  ruleType?: InterestRuleType;
  effectiveFrom: string;
  remarks?: string;
  customFormula?: string;
  includeOpeningClosingDays?: boolean;
  calculationMethod?: CalculationMethod;
}

export interface CalculateInterestInput {
  asOfDate: string;
  loanDisbursementDate: string;
  outstandingPrincipal: number;
  overdueInstallmentAmount: number;
  daysLate: number;
  wasExtended: boolean;
}

export interface CalculateInterestResult {
  baseInterest: number;
  effectiveRate: number;
  rateSource: "BASE_RATE" | "TIME_SLAB" | "EVENT_TRIGGERED";
  penalty: number;
  penaltyApplied: boolean;
  totalInterest: number;
}

export interface InterestRule {
  id: string;
  interestConfigId: string;
  fromMonth: number | null;
  toMonth: number | null;
  rate: string;
  triggerEvent: string | null;
  remarks: string | null;
}

export interface CreateInterestRuleInput {
  interestConfigId: string;
  fromMonth?: number;
  toMonth?: number;
  rate: number;
  triggerEvent?: string;
  remarks?: string;
}

export const PENAL_TYPE_OPTIONS = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
export type PenalType = (typeof PENAL_TYPE_OPTIONS)[number];

export const PENAL_BASE_OPTIONS = ["ENTIRE_OUTSTANDING", "OVERDUE_INSTALLMENT_ONLY"] as const;
export type PenalBase = (typeof PENAL_BASE_OPTIONS)[number];

export interface PenalInterestRule {
  id: string;
  loanId: string;
  penalType: PenalType;
  penalRate: string | null;
  penalAmount: string | null;
  penalBase: PenalBase;
  gracePeriodDays: number;
  isCurrent: boolean;
  remarks: string | null;
}

export interface CreatePenalRuleInput {
  loanId: string;
  penalType: PenalType;
  penalRate?: number;
  penalAmount?: number;
  penalBase?: PenalBase;
  gracePeriodDays?: number;
  remarks?: string;
}
