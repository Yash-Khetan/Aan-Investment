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