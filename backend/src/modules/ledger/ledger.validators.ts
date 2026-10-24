import { z } from "zod";

import { EDITABLE_VCH_TYPES } from "./entryRules";

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

/**
 * An edit to a hand-recorded Payment/Receipt. Every field is optional — the
 * ones sent are the ones that change — but a request that sends none is
 * refused rather than silently doing nothing.
 *
 * This is also the list of what may be edited at all. A derived or
 * system-managed column (debit/credit, vchNo, the rate/basis snapshots, the
 * accrual month, source, importId…) has no key here, so a request naming one
 * cannot reach the row: Zod strips it. See entryRules.ts.
 */
export const updateEntrySchema = z
  .object({
    entryDate: z.string().date().optional(),
    vchType: z.enum(EDITABLE_VCH_TYPES).optional(),
    amount: z.coerce.number().positive().optional(),
    /** Empty or null clears the narration. */
    narration: z.string().nullish(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Send at least one field to change: entryDate, vchType, amount or narration.",
  });
