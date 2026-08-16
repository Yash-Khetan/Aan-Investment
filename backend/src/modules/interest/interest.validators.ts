import { z } from "zod";

// THIRTY_360 and MONTHLY are retired from selection (no longer offered by
// the frontend) but stay valid here so any pre-existing config referencing
// them keeps working — see strategies/index.ts.
const interestBasisValues = [
  "ACTUAL_365",
  "ACTUAL_360",
  "THIRTY_360",
  "MONTHLY",
  "FIXED_MONTHLY",
  "FULL_MONTH",
  "CUSTOM",
  "MONTHLY_RATE_ACTUAL_30",
] as const;

const ruleTypeValues = ["NORMAL", "STEP_UP", "STEP_DOWN", "EVENT_BASED", "CUSTOM"] as const;

const calculationMethodValues = ["RUNNING_BALANCE", "SIMPLE_INTEREST"] as const;

export const createInterestConfigSchema = z.object({
  loanId: z.string().uuid(),
  annualRate: z.coerce.number().positive(),
  interestBasis: z.enum(interestBasisValues),
  ruleType: z.enum(ruleTypeValues).optional(),
  effectiveFrom: z.string().date(),
  remarks: z.string().optional(),
  customFormula: z.string().optional(),
  includeOpeningClosingDays: z.boolean().optional().default(false),
  calculationMethod: z.enum(calculationMethodValues).optional().default("SIMPLE_INTEREST"),
}).refine(
  (data) => data.interestBasis !== "CUSTOM" || !!data.customFormula,
  { message: "customFormula is required when interestBasis is CUSTOM", path: ["customFormula"] }
).refine(
  (data) =>
    data.calculationMethod !== "RUNNING_BALANCE" ||
    (data.interestBasis !== "FULL_MONTH" && data.interestBasis !== "CUSTOM"),
  {
    message: "Running Balance Method isn't supported for FULL_MONTH or CUSTOM interest basis",
    path: ["calculationMethod"],
  }
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