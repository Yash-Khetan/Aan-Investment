import { z } from "zod";

export const loanIdParamSchema = z.object({
  loanId: z.string().uuid(),
});

export const recordWriteOffSchema = z.object({
  loanId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  entryDate: z.string().date(),
});