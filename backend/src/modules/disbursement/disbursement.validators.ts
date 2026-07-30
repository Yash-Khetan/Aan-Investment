import { z } from "zod";

const uuid = z.string().uuid("must be a valid UUID");

export const loanIdParamSchema = z.object({
    loanId: uuid,
});

export const createDisbursementSchema = z
    .object({
        amount: z.coerce.number().positive("must be a positive amount"),
        disbursementDate: z.string().date("must be a valid date (YYYY-MM-DD)"),
        remarks: z.string().trim().max(500).optional(),
    })
    .strict();
