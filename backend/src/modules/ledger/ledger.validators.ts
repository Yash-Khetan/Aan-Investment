import { z } from "zod";

export const loanIdParamSchema = z.object({
  loanId: z.string().uuid(),
});

export const createEntrySchema = z.object({
  entryDate: z.string().date(),
  vchType: z.enum(["PAYMENT", "RECEIPT"]),
  amount: z.coerce.number().positive(),
  narration: z.string().optional(),
});
