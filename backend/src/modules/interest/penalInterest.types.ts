export type PenalType = "PERCENTAGE" | "FIXED_AMOUNT";
export type PenalBase = "ENTIRE_OUTSTANDING" | "OVERDUE_INSTALLMENT_ONLY";

export interface PenalInterestRuleRow {
  id: string;
  loanId: string;
  penalType: PenalType;
  penalRate: string | null;   // numeric from DB comes back as string
  penalAmount: string | null;
  penalBase: PenalBase;
  gracePeriodDays: number;
}

export interface PenalCalculationInput {
  rule: PenalInterestRuleRow;
  daysLate: number;
  outstandingPrincipal: number;
  overdueInstallmentAmount: number;
}

export interface PenalCalculationResult {
  penaltyAmount: number;
  applied: boolean;
  reason: "WITHIN_GRACE_PERIOD" | "APPLIED" | "NOT_LATE";
}