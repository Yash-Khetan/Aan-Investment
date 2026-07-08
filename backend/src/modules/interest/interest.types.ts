export interface InterestCalculationInput {
  principal: number;
  annualRate: number; // percentage, e.g. 18 means 18%
  periodStart: Date;
  periodEnd: Date;
}

export interface InterestStrategy {
  calculate(input: InterestCalculationInput): number;
}

export type InterestBasis =
  | "ACTUAL_365"
  | "ACTUAL_360"
  | "THIRTY_360"
  | "MONTHLY"
  | "FIXED_MONTHLY"
  | "FULL_MONTH"
  | "CUSTOM";

  export interface InterestRuleRow {
  id: string;
  interestConfigId: string;
  fromMonth: number | null;
  toMonth: number | null;
  rate: string; // numeric comes back as string from drizzle/postgres
  triggerEvent: string | null;
}

export interface EffectiveRateInput {
  baseRate: number;
  rules: InterestRuleRow[];
  loanAgeInMonths: number;
  activeEvents: string[]; // e.g. ["PAYMENT_DELAYED", "LOAN_EXTENDED"]
}

export interface EffectiveRateResult {
  rate: number;
  appliedRuleId: string | null; // null if base rate applied, no rule matched
  reason: "BASE_RATE" | "TIME_SLAB" | "EVENT_TRIGGERED";
}