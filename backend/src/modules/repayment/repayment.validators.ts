import { z } from "zod";

const repaymentTypeValues = ["EMI", "BULLET", "INTEREST_ONLY", "STRUCTURED", "CUSTOM"] as const;

export const generateScheduleSchema = z.object({
  loanId: z.string().uuid(),
  principal: z.coerce.number().positive(),
  annualRate: z.coerce.number().nonnegative(),
  tenureMonths: z.coerce.number().int().positive(),
  moratoriumMonths: z.coerce.number().int().nonnegative().default(0),
  disbursementDate: z.string().date(),
  repaymentType: z.enum(repaymentTypeValues),
  remarks: z.string().optional(),
});

export const loanIdParamSchema = z.object({
  loanId: z.string().uuid(),
});