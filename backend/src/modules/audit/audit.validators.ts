import { z } from "zod";

import {
    AUDIT_ACTIONS,
    DEFAULT_LIMIT,
    DEFAULT_PAGE,
    DEFAULT_SORT_BY,
    DEFAULT_SORT_ORDER,
    MAX_LIMIT,
} from "./audit.constants";

/**
 * Zod schemas for the audit READ endpoints.
 *
 * There are no write schemas, and there never will be: audit records are system
 * generated. No client may create, edit or delete one, so there is nothing for a
 * request body to describe.
 *
 * Note what is ABSENT from the query schema: `userId`. Ownership is not a filter
 * the caller may express — it is taken from the access token and applied in the
 * repository. Accepting a `userId` here, even optionally, would be the bug that
 * lets employee A read employee B's trail.
 */

/** GET /audit — filtering, pagination and sorting over the caller's own records. */
export const listAuditQuerySchema = z
    .object({
        page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
        limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),

        /** Module filter, e.g. "LOAN". Free-form by design — see AUDIT_ENTITY. */
        entityType: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .transform((v) => v.toUpperCase())
            .optional(),

        /** Narrow to one specific record, e.g. every change to one loan. */
        entityId: z.uuid("entityId must be a valid UUID").optional(),

        action: z.enum(AUDIT_ACTIONS).optional(),

        /** Inclusive lower bound on the record timestamp. */
        from: z.coerce.date().optional(),
        /** Inclusive upper bound on the record timestamp. */
        to: z.coerce.date().optional(),

        sortBy: z.enum(["createdAt", "action", "entityType"]).default(DEFAULT_SORT_BY),
        sortOrder: z.enum(["asc", "desc"]).default(DEFAULT_SORT_ORDER),
    })
    .refine((q) => !q.from || !q.to || q.from <= q.to, {
        message: "'from' must be on or before 'to'",
        path: ["from"],
    });

/** GET /audit/:id */
export const auditIdParamSchema = z.object({
    id: z.uuid("Audit id must be a valid UUID"),
});

export type ListAuditQueryInput = z.infer<typeof listAuditQuerySchema>;
export type AuditIdParam = z.infer<typeof auditIdParamSchema>;
