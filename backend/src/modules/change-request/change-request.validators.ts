import { z } from "zod";

const ENTITY_TYPES = [
    "LOAN",
    "COLLATERAL",
    "COLLATERAL_INSURANCE",
    "LEDGER_ENTRY",
    "LEDGER_IMPORT",
] as const;

export const listChangeRequestsQuerySchema = z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    entityType: z.enum(ENTITY_TYPES).optional(),
    loanId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const changeRequestIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const reviewBodySchema = z.object({
    notes: z.string().trim().max(2000).optional(),
});

export const bulkIdsBodySchema = z.object({
    ids: z.array(z.string().uuid()).min(1, "At least one id is required"),
    notes: z.string().trim().max(2000).optional(),
});

export const allFiltersBodySchema = z.object({
    entityType: z.enum(ENTITY_TYPES).optional(),
    loanId: z.string().uuid().optional(),
    notes: z.string().trim().max(2000).optional(),
});
