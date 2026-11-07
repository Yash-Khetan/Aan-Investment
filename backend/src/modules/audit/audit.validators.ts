import { z } from "zod";

export const listAuditLogsQuerySchema = z.object({
    entityType: z.string().trim().min(1).optional(),
    userId: z.string().uuid().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
});
