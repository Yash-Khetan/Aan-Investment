import { z } from "zod";

export const loanIdParamSchema = z.object({
  loanId: z.string().uuid(),
});

export const recordDisbursementSchema = z.object({
  loanId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  entryDate: z.string().date(),
});

export const recordWriteOffSchema = z.object({
  loanId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  entryDate: z.string().date(),
});