import { z } from "zod";

export const loanIdParamSchema = z.object({
  loanId: z.string().uuid(),
});

export const entryIdParamSchema = z.object({
  loanId: z.string().uuid(),
  entryId: z.string().uuid(),
});

export const createEntrySchema = z.object({
  entryDate: z.string().date(),
  vchType: z.enum(["PAYMENT", "RECEIPT"]),
  amount: z.coerce.number().positive(),
  narration: z.string().optional(),
});

export const editRateSchema = z.object({
  ratePercent: z.coerce.number().min(0).max(100),
});

/** Interest lands in loans.interest_rate — numeric(8,4) — so four decimals are accepted here. */
export const updateSettingsSchema = z.object({
  defaultInterestRatePercent: z.coerce.number().min(0).max(100).multipleOf(0.0001),
  defaultTdsRatePercent: z.coerce.number().min(0).max(100).multipleOf(0.01),
});
