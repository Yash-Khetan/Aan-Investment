import { insertAuditLog, type AuditDbOrTx, type AuditLogRow } from "./audit.repository";
import type { AuditRecordInput } from "./audit.types";

/**
 * The audit trail: who changed which record, when, and what the values were
 * before and after.
 *
 * Two rules it keeps, both borrowed from how the notifications module records
 * a dispatch:
 *
 *   - Nothing sensitive is stored at rest. Values pass through `sanitize`
 *     below, which drops anything whose field name reads like a credential and
 *     caps how much text one value can carry.
 *   - A trail entry belongs to the change it describes. Pass the transaction
 *     making the change as `tx` and the audit row commits with it — a rejected
 *     edit leaves no trail entry behind, and an applied one is never missing
 *     from the trail.
 */

/** Field names whose value is never written to the trail. */
const REDACTED_KEY = /pass(word)?|token|secret|hash|otp|credential|authorization|cookie|api[_-]?key/i;

const REDACTED = "[redacted]";

/** Longer than any field this trail is meant to carry; longer values are kept, trimmed. */
const MAX_STRING_LENGTH = 2000;

/** How deep into a nested value to walk before giving up on describing it. */
const MAX_DEPTH = 6;

/**
 * A value as it is safe to store: credential-looking fields replaced, long
 * text trimmed, anything the trail cannot usefully hold (a function, a class
 * instance with no plain shape) described rather than serialized.
 */
export function sanitize(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) return null;

    if (typeof value === "string") {
        return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
    }

    if (typeof value === "number" || typeof value === "boolean") return value;

    if (value instanceof Date) return value.toISOString();

    if (depth >= MAX_DEPTH) return "[too deeply nested]";

    if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));

    if (typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
            result[key] = REDACTED_KEY.test(key) ? REDACTED : sanitize(inner, depth + 1);
        }
        return result;
    }

    return String(value);
}

/**
 * Records one change. Throws if the row cannot be written — a caller that
 * passes its own `tx` is relying on exactly that: an audit failure must take
 * the change down with it rather than leave an unrecorded edit behind.
 */
export async function recordAudit(input: AuditRecordInput, tx?: AuditDbOrTx): Promise<AuditLogRow> {
    return insertAuditLog(
        {
            userId: input.actor.userId,
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId,
            oldValues: input.oldValues === undefined ? null : sanitize(input.oldValues),
            newValues: input.newValues === undefined ? null : sanitize(input.newValues),
            ipAddress: input.actor.ipAddress ?? null,
            userAgent: typeof input.actor.userAgent === "string"
                ? (sanitize(input.actor.userAgent) as string)
                : null,
        },
        tx,
    );
}
