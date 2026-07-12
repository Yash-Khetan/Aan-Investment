import { NotFoundError } from "../../common/errors";
import { logger } from "../../utils/logger";
import * as auditRepository from "./audit.repository";
import {
    MAX_SANITIZE_DEPTH,
    REDACTED,
    SENSITIVE_KEY_PATTERNS,
} from "./audit.constants";
import type {
    AuditLogRow,
    AuditLogView,
    AuditPaginationMeta,
    ListAuditQuery,
    NewAuditLog,
    RecordAuditInput,
} from "./audit.types";

/**
 * Audit business layer — the ONE entry point every other module uses.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ HOW A MODULE INTEGRATES (this is the whole contract — 1 call, no wiring)  │
 * │                                                                           │
 * │   import { auditService, AUDIT_ENTITY } from "../audit";                  │
 * │                                                                           │
 * │   const loan = await loanRepository.create(values);                       │
 * │   await auditService.record({                                             │
 * │       ...ctx,                    // { userId, ipAddress, userAgent }      │
 * │       entityType: AUDIT_ENTITY.LOAN,                                      │
 * │       entityId: loan.id,                                                  │
 * │       action: "CREATE",                                                   │
 * │       newValue: loan,                                                     │
 * │   });                                                                     │
 * │                                                                           │
 * │ For an UPDATE, pass the whole `previousValue` and `newValue` rows — this  │
 * │ service diffs them itself and stores only what actually changed.          │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Payment, Collection, Documents, Interest, Repayment … all use the same call.
 * Nothing in this file names a business concept, so no future module requires a
 * change here.
 */

/* ------------------------------------------------------------------ *
 * Sanitization
 * ------------------------------------------------------------------ */

/** True if a key looks like it carries a secret. */
function isSensitiveKey(key: string): boolean {
    const lowered = key.toLowerCase();
    return SENSITIVE_KEY_PATTERNS.some((pattern) => lowered.includes(pattern));
}

/**
 * Deep-copy a value into something safe and JSON-storable:
 *  - values under a sensitive key are replaced with "[REDACTED]"
 *  - Dates become ISO strings (jsonb has no date type)
 *  - recursion stops at MAX_SANITIZE_DEPTH, so a cycle can't hang a write
 *
 * Audit rows are permanent AND readable over HTTP, so a password hash written
 * here would be a permanent, readable password hash. Redaction is mandatory,
 * which is why it lives in the service and not at the (skippable) call sites.
 */
function sanitize(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) return null;
    if (depth >= MAX_SANITIZE_DEPTH) return REDACTED;

    if (value instanceof Date) return value.toISOString();

    const primitive = typeof value;
    if (primitive === "string" || primitive === "number" || primitive === "boolean") {
        return value;
    }
    if (primitive === "bigint") return String(value);
    if (primitive === "function" || primitive === "symbol") return undefined;

    if (Array.isArray(value)) {
        return value.map((item) => sanitize(item, depth + 1));
    }

    if (primitive === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
            if (isSensitiveKey(key)) {
                result[key] = REDACTED;
                continue;
            }
            const cleaned = sanitize(val, depth + 1);
            if (cleaned !== undefined) result[key] = cleaned;
        }
        return result;
    }

    return null;
}

/* ------------------------------------------------------------------ *
 * Diffing
 * ------------------------------------------------------------------ */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Reduce a before/after pair to ONLY the fields that actually changed.
 *
 * Storing the full row on both sides would make every `UPDATE` audit row a wall
 * of identical values, and the reader would have to diff it by eye to answer the
 * only question that matters: what changed? Unchanged fields (and noise like
 * `updatedAt`) are dropped from both sides.
 *
 * Returns `null` when nothing changed — the caller then skips the write entirely
 * rather than logging a no-op update.
 */
function diff(
    before: unknown,
    after: unknown,
): { previousValue: unknown; newValue: unknown } | null {
    if (!isPlainObject(before) || !isPlainObject(after)) {
        // Not two comparable objects — store both sides verbatim.
        return { previousValue: before ?? null, newValue: after ?? null };
    }

    const previousValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    // Only keys present in the "after" side can have been changed BY this action.
    for (const key of Object.keys(after)) {
        if (key === "updatedAt") continue; // Always changes; carries no information.

        const oldVal = before[key];
        const newVal = after[key];
        if (JSON.stringify(oldVal ?? null) === JSON.stringify(newVal ?? null)) continue;

        previousValue[key] = oldVal ?? null;
        newValue[key] = newVal ?? null;
    }

    if (Object.keys(newValue).length === 0) return null;
    return { previousValue, newValue };
}

/* ------------------------------------------------------------------ *
 * Write API — the only thing business modules call
 * ------------------------------------------------------------------ */

/**
 * record — persist one audit entry. THIS IS THE ENTIRE WRITE API.
 *
 * NEVER THROWS. An audit write is a side-effect of a business action that has
 * already succeeded; if the audit insert fails (DB hiccup, FK violation, bad
 * payload) we log loudly and return, because failing a completed loan creation
 * because its audit row would not write is worse than a gap in the trail. The
 * failure is logged at ERROR with the full entry, so it is recoverable from logs
 * and alertable.
 *
 * On UPDATE, `previousValue`/`newValue` are diffed down to the changed fields.
 * If nothing changed, no row is written.
 */
export async function record(input: RecordAuditInput): Promise<void> {
    try {
        let previousValue = input.previousValue;
        let newValue = input.newValue;

        if (
            input.action === "UPDATE" &&
            previousValue !== undefined &&
            newValue !== undefined
        ) {
            const changed = diff(previousValue, newValue);
            if (!changed) return; // Nothing actually changed — nothing to audit.
            previousValue = changed.previousValue;
            newValue = changed.newValue;
        }

        const values: NewAuditLog = {
            userId: input.userId ?? null,
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId ?? null,
            oldValues: previousValue === undefined ? null : sanitize(previousValue),
            newValues: newValue === undefined ? null : sanitize(newValue),
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
            description: input.description ?? null,
        };

        await auditRepository.insert(values);
    } catch (error) {
        // Swallow: audit must never be able to fail the business action.
        logger.error("Failed to write audit record", {
            err: error,
            entityType: input.entityType,
            entityId: input.entityId,
            action: input.action,
            userId: input.userId,
        });
    }
}

/* ------------------------------------------------------------------ *
 * Read API — own records only
 * ------------------------------------------------------------------ */

/** Map a DB row to the SRS-shaped client projection. */
function toView(row: AuditLogRow): AuditLogView {
    // created_at is one timestamptz; the SRS asks for Date and Time separately,
    // so we split it on read instead of storing the same instant twice.
    const iso = row.createdAt?.toISOString() ?? null;
    const [date, timeWithMs] = iso ? iso.split("T") : [null, null];

    return {
        id: row.id,
        userId: row.userId,
        date: date ?? null,
        time: timeWithMs ? timeWithMs.slice(0, 8) : null,
        timestamp: iso,
        module: row.entityType,
        entityId: row.entityId,
        action: row.action,
        previousValue: row.oldValues,
        newValue: row.newValues,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        description: row.description,
    };
}

/**
 * listMyLogs — the authenticated employee's OWN audit trail, paginated.
 *
 * `userId` comes from the verified access token (req.user.id), never from the
 * query string, and the repository pins the WHERE clause to it. There is no
 * "list everyone's records" function anywhere in this module, so no employee can
 * reach another employee's rows. When an ADMIN/AUDITOR role arrives, that widens
 * into a separate, permission-gated repository function — this one stays as is.
 */
export async function listMyLogs(
    userId: string,
    query: ListAuditQuery,
): Promise<{ data: AuditLogView[]; meta: AuditPaginationMeta }> {
    const { rows, total } = await auditRepository.findAllForUser(userId, query);

    return {
        data: rows.map(toView),
        meta: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    };
}

/**
 * getMyLogById — one of the authenticated employee's OWN audit records.
 *
 * A record owned by another user yields 404, not 403: a 403 would confirm that
 * the id exists, which is itself a small leak.
 */
export async function getMyLogById(
    id: string,
    userId: string,
): Promise<AuditLogView> {
    const row = await auditRepository.findByIdForUser(id, userId);
    if (!row) throw new NotFoundError("Audit record not found");
    return toView(row);
}

/**
 * Namespace object, so callers can use the documented `auditService.record(...)`
 * form: `import { auditService } from "../audit"`.
 */
export const auditService = {
    record,
    listMyLogs,
    getMyLogById,
};
