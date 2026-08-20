import { z } from "zod";

export const borrowerIdParamSchema = z.object({
  borrowerId: z.string().uuid(),
});

export const entryIdParamSchema = z.object({
  borrowerId: z.string().uuid(),
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

export const updateSettingsSchema = z.object({
  defaultInterestRatePercent: z.coerce.number().min(0).max(100),
  defaultTdsRatePercent: z.coerce.number().min(0).max(100),
});
