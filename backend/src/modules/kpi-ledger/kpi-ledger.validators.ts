import { z } from "zod";

export const loanIdParamSchema = z.object({
  loanId: z.string().uuid(),
});

export const importIdParamSchema = z.object({
  loanId: z.string().uuid(),
  importId: z.string().uuid(),
});

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/** page 1 = the first 30 rows in history order (rowIndex asc). */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

/** One sheet row, every cell as the sheet shows it — no coercion here; sheet.ts reads them. */
const sheetRowSchema = z.object({
  date: z.string().nullable(),
  particulars: z.string().default(""),
  narration: z.string().nullish(),
  drCr: z.string().nullish(),
  vchType: z.string().nullable(),
  vchNo: z.string().nullable(),
  debit: z.string().nullable(),
  credit: z.string().nullable(),
  balance: z.string().nullable(),
});

/** One sheet of a workbook, to preview or post into a loan's ledger. */
export const importSheetSchema = z.object({
  fileName: z.string().max(255).nullish(),
  sheetName: z.string().max(255).nullish(),
  meta: z.string().nullish(),
  rows: z.array(sheetRowSchema).min(1, "The sheet has no rows.").max(20000, "The sheet has too many rows to import at once."),
});
