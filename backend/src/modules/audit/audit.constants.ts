import { auditLogs } from "../../db/schema";

/**
 * Audit module constants.
 *
 * Nothing in this file (or anywhere in the audit module) may import a business
 * module. Audit is cross-cutting: business modules depend on IT, never the
 * reverse. That is what keeps `auditService.record()` reusable by Interest,
 * Repayment, Payment, Collection, Documents… without touching this module.
 */

/**
 * Well-known values for `audit_logs.entity_type` — the "module" the record
 * belongs to.
 *
 * These are CONVENIENCE constants, not a closed set. The column is a plain
 * `varchar(100)`, so a new module can pass its own string and start writing
 * audit rows without editing this file or running a migration. They exist only
 * so the modules we already know about spell themselves consistently.
 */
export const AUDIT_ENTITY = {
    USER: "USER",
    BORROWER: "BORROWER",
    LOAN: "LOAN",
    INTEREST: "INTEREST",
    REPAYMENT: "REPAYMENT",
    PAYMENT: "PAYMENT",
    COLLECTION: "COLLECTION",
    COLLATERAL: "COLLATERAL",
    DOCUMENT: "DOCUMENT",
} as const;

/**
 * The action taxonomy, mirrored from the `audit_action` Postgres enum in
 * `db/schema/shared.ts`. Read straight off the Drizzle column so the two can
 * never drift: adding a value to the enum makes it available here for free.
 */
export const AUDIT_ACTIONS = auditLogs.action.enumValues;

/**
 * Keys whose values must never reach the audit table. Matched case-insensitively
 * as a SUBSTRING of the key, so `passwordHash`, `password_hash`, `newPassword`,
 * `refreshToken` and `tokenHash` are all caught by "password"/"token".
 *
 * Audit rows are permanent and readable over HTTP. A secret written here is a
 * secret leaked forever — this list is a security control, not a nicety.
 */
export const SENSITIVE_KEY_PATTERNS = [
    "password",
    "token",
    "secret",
    "apikey",
    "api_key",
    "authorization",
    "otp",
    "pin",
] as const;

/** Stand-in written in place of a sensitive value. */
export const REDACTED = "[REDACTED]";

/**
 * Hard ceiling on how deep the sanitizer walks a value. Guards against a cyclic
 * or pathologically nested object turning an audit write into a hang.
 */
export const MAX_SANITIZE_DEPTH = 8;

/** Pagination defaults for the read API. */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** Columns a caller may sort the audit list by. */
export const SORTABLE_COLUMNS = {
    createdAt: auditLogs.createdAt,
    action: auditLogs.action,
    entityType: auditLogs.entityType,
} as const;

export const DEFAULT_SORT_BY = "createdAt";
export const DEFAULT_SORT_ORDER = "desc";
