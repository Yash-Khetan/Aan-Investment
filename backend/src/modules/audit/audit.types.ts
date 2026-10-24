/** What an audit row records having happened. Mirrors the `audit_action` enum. */
export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT";

/**
 * Who did it and from where. `userId` is null only for something the system
 * did on nobody's behalf; a request-driven change always has one.
 */
export interface AuditActor {
    userId: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
}

export interface AuditRecordInput {
    actor: AuditActor;
    action: AuditAction;
    /** The kind of record acted on, e.g. "LEDGER_ENTRY". Use the constants in audit.constants.ts. */
    entityType: string;
    entityId: string;
    /** The changed fields as they were. Left out on a CREATE. */
    oldValues?: unknown;
    /** The changed fields as they became. Left out on a DELETE. */
    newValues?: unknown;
}
