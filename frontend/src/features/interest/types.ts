export const INTEREST_BASIS_OPTIONS = [
  { value: "ACTUAL_365", label: "Actual Days / 365" },
  { value: "ACTUAL_360", label: "Actual Days / 360" },
  { value: "THIRTY_360", label: "30/360 Method" },
  { value: "MONTHLY", label: "Monthly Basis" },
  { value: "FIXED_MONTHLY", label: "Fixed Monthly Interest" },
  { value: "FULL_MONTH", label: "Full Month Interest on Disbursement" },
  { value: "CUSTOM", label: "Customized Formula" },
] as const;

export type InterestBasis = (typeof INTEREST_BASIS_OPTIONS)[number]["value"];

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
