import { z } from "zod";

const interestBasisValues = [
  "ACTUAL_365",
  "ACTUAL_360",
  "THIRTY_360",
  "MONTHLY",
  "FIXED_MONTHLY",
  "FULL_MONTH",
  "CUSTOM",
] as const;

const ruleTypeValues = ["NORMAL", "STEP_UP", "STEP_DOWN", "EVENT_BASED", "CUSTOM"] as const;

export const createInterestConfigSchema = z.object({
  loanId: z.string().uuid(),
  annualRate: z.coerce.number().positive(),
  interestBasis: z.enum(interestBasisValues),
  ruleType: z.enum(ruleTypeValues).optional(),
  effectiveFrom: z.string().date(),
  remarks: z.string().optional(),
  customFormula: z.string().optional(),
}).refine(
  (data) => data.interestBasis !== "CUSTOM" || !!data.customFormula,
  { message: "customFormula is required when interestBasis is CUSTOM", path: ["customFormula"] }
);

export const loanIdParamSchema = z.object({
  loanId: z.string().uuid(),
});

export const calculateInterestSchema = z.object({
  asOfDate: z.string().date(),
  loanDisbursementDate: z.string().date(),
  outstandingPrincipal: z.coerce.number().nonnegative(),
  overdueInstallmentAmount: z.coerce.number().nonnegative(),
  daysLate: z.coerce.number().int().nonnegative(),
  wasExtended: z.boolean().default(false),
  installments: z
    .array(
      z.object({
        id: z.string(),
        dueDate: z.string().date(),
        status: z.enum(["PENDING", "PARTIAL", "SUCCESS", "FAILED", "CANCELLED"]),
      })
    )
    .default([]),
});


export const createInterestRuleSchema = z.object({
  interestConfigId: z.string().uuid(),
  fromMonth: z.coerce.number().int().nonnegative().optional(),
  toMonth: z.coerce.number().int().nonnegative().optional(),
  rate: z.coerce.number().nonnegative(),
  triggerEvent: z.string().optional(),
  remarks: z.string().optional(),
});

export const ruleIdParamSchema = z.object({
  ruleId: z.string().uuid(),
});

export const createPenalRuleSchema = z.object({
  loanId: z.string().uuid(),
  penalType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  penalRate: z.coerce.number().nonnegative().optional(),
  penalAmount: z.coerce.number().nonnegative().optional(),
  penalBase: z.enum(["ENTIRE_OUTSTANDING", "OVERDUE_INSTALLMENT_ONLY"]).optional(),
  gracePeriodDays: z.coerce.number().int().nonnegative().optional(),
  remarks: z.string().optional(),
});

export const configIdParamSchema = z.object({
  configId: z.string().uuid(),
});