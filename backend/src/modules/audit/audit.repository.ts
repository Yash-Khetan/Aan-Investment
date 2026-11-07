import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, auditLogs } from "../../db";

export type AuditLogRow = typeof auditLogs.$inferSelect;

export interface ListAuditLogsFilters {
    entityType?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
}

/** Either the top-level `db` or a transaction handle — an audit row is usually written inside the change it describes. */
export type AuditDbOrTx = typeof db | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/**
 * Appends one audit row. Insert-only by design: nothing in this module
 * updates or deletes a row, and no caller is given a way to.
 *
 * `tx` is how an audit row becomes part of the change it records — pass the
 * transaction doing the change and the two commit or roll back together, so
 * the trail can never claim an edit that did not happen, nor miss one that did.
 */
export async function insertAuditLog(
    values: typeof auditLogs.$inferInsert,
    tx?: AuditDbOrTx,
): Promise<AuditLogRow> {
    const executor = tx ?? db;
    const [created] = await executor.insert(auditLogs).values(values).returning();

    if (!created) {
        throw new Error("Failed to write the audit log entry.");
    }

    return created;
}

export async function listAuditLogs(filters: ListAuditLogsFilters): Promise<AuditLogRow[]> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;

    const clauses = [];
    if (filters.entityType) clauses.push(eq(auditLogs.entityType, filters.entityType));
    if (filters.userId) clauses.push(eq(auditLogs.userId, filters.userId));
    if (filters.dateFrom) clauses.push(gte(auditLogs.createdAt, new Date(filters.dateFrom)));
    if (filters.dateTo) clauses.push(lte(auditLogs.createdAt, new Date(filters.dateTo)));

    return db
        .select()
        .from(auditLogs)
        .where(clauses.length > 0 ? and(...clauses) : undefined)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset((page - 1) * limit);
}
