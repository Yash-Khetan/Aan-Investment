import { z } from "zod";

export const loanIdParamSchema = z.object({
  loanId: z.string().uuid(),
});

export const rowIdParamSchema = z.object({
  loanId: z.string().uuid(),
  rowId: z.string().uuid(),
});

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/** page 1 = the first 30 rows in history order (rowIndex asc), matching the frontend's "30 at a time" ask. */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

/**
 * One row as parsed in the browser or typed into the "add entry" form. Every
 * value is kept as text exactly as shown in the sheet — no coercion here.
 */
export const rowInputSchema = z.object({
  date: z.string().nullish(),
  particulars: z.string().default(""),
  vchType: z.string().nullish(),
  vchNo: z.string().nullish(),
  debit: z.string().nullish(),
  credit: z.string().nullish(),
  balance: z.string().nullish(),
});

export const attachBodySchema = z.object({
  rows: z.array(rowInputSchema).min(1, "At least one row is required."),
  sourceFileName: z.string().optional(),
  sourceMeta: z.string().optional(),
});

/** PATCH body — any subset of the editable fields, but not an empty object. */
export const rowPatchSchema = rowInputSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Provide at least one field to update.",
  });
