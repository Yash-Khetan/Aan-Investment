import type { auditLogs } from "../../db/schema";
import type { SORTABLE_COLUMNS } from "./audit.constants";

/**
 * Shared TypeScript contracts for audit (no runtime code).
 *
 * Deliberately free of any business vocabulary: no Loan, no Borrower, no
 * Payment. `entityType` is just a string and the values are just JSON, which is
 * exactly what lets every present and future module reuse this one service.
 */

/** A row as it comes out of the database. */
export type AuditLogRow = typeof auditLogs.$inferSelect;

/** A row as it goes into the database. */
export type NewAuditLog = typeof auditLogs.$inferInsert;

/** The action taxonomy — derived from the `audit_action` Postgres enum. */
export type AuditAction = AuditLogRow["action"];

/**
 * Who did it and from where.
 *
 * Services have no access to `req`, so the controller captures this at the HTTP
 * edge and threads it down. Explicit beats an ambient AsyncLocalStorage context:
 * the actor becomes part of the service signature, so it cannot be silently
 * forgotten, and it stays trivially unit-testable.
 */
export interface AuditContext {
    /** Authenticated actor (`req.user.id`). Null for unauthenticated/system actions. */
    userId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
}

/**
 * The ONE input shape every module uses.
 *
 * There is no `recordLoanAudit` / `recordBorrowerAudit`. There is only
 * `auditService.record(...)`, and a module identifies itself with a string.
 */
export interface RecordAuditInput extends AuditContext {
    /** Which module/table this concerns, e.g. "LOAN". See AUDIT_ENTITY. */
    entityType: string;
    /** The affected row's id. Null for actions with no single subject (e.g. LOGIN). */
    entityId?: string | null;
    action: AuditAction;
    /** State BEFORE the change. Omit on CREATE. (SRS: "Previous Value") */
    previousValue?: unknown;
    /** State AFTER the change. Omit on DELETE. (SRS: "New Value") */
    newValue?: unknown;
    /** Optional human-readable note, e.g. "Loan disbursed". */
    description?: string | null;
}

/** Validated query for the audit list endpoint. */
export interface ListAuditQuery {
    page: number;
    limit: number;
    entityType?: string;
    entityId?: string;
    action?: AuditAction;
    /** Inclusive lower bound on createdAt (ISO date or datetime). */
    from?: Date;
    /** Inclusive upper bound on createdAt. */
    to?: Date;
    sortBy: keyof typeof SORTABLE_COLUMNS;
    sortOrder: "asc" | "desc";
}

/**
 * The client-facing projection, named after the SRS fields it satisfies.
 *
 * `date` and `time` are DERIVED from the single `created_at` timestamptz — the
 * SRS asks for Date and Time, but storing them separately would be redundant and
 * would break ordering and range queries.
 */
export interface AuditLogView {
    id: string;
    /** SRS: "User". */
    userId: string | null;
    /** SRS: "Date" — YYYY-MM-DD (UTC). */
    date: string | null;
    /** SRS: "Time" — HH:MM:SS (UTC). */
    time: string | null;
    /** Full ISO-8601 instant, for clients that want to render in local time. */
    timestamp: string | null;
    /** The module that produced the record (`entity_type`). */
    module: string;
    entityId: string | null;
    action: AuditAction;
    /** SRS: "Previous Value". */
    previousValue: unknown;
    /** SRS: "New Value". */
    newValue: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    description: string | null;
}

/** Standard pagination envelope returned alongside a list. */
export interface AuditPaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
