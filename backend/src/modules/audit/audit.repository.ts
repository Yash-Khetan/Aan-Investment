import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { db, auditLogs } from "../../db";
import { SORTABLE_COLUMNS } from "./audit.constants";
import type { AuditLogRow, ListAuditQuery, NewAuditLog } from "./audit.types";

/**
 * Audit data-access layer — APPEND-ONLY BY CONSTRUCTION.
 *
 * The SRS requires that audit records are never deleted. That guarantee is not
 * enforced by a policy comment or a missing route: it is enforced by the fact
 * that this file exposes NO update, NO delete and NO soft-delete function. There
 * is no code path in the application that can mutate or remove an audit row, so
 * no future controller can accidentally wire one up.
 *
 * (Belt-and-braces at the DB level — `REVOKE UPDATE, DELETE ON audit_logs FROM
 * <app_user>` — is a DBA grant, not application code, and is left to deployment.)
 *
 * Every read here is scoped to a single `userId`. Row-level visibility is
 * enforced HERE, in the WHERE clause, not in the controller: an employee cannot
 * widen their view by crafting a query parameter, because there is no function
 * that reads another user's rows.
 */

/** Append one audit row. The only write this module performs. */
export async function insert(values: NewAuditLog): Promise<AuditLogRow> {
    const [row] = await db.insert(auditLogs).values(values).returning();
    return row!;
}

/** Build the WHERE clauses for a list query, always pinned to one user. */
function buildFilters(userId: string, query: ListAuditQuery): SQL[] {
    // The ownership predicate is first and is NOT derived from client input.
    const filters: SQL[] = [eq(auditLogs.userId, userId)];

    if (query.entityType) filters.push(eq(auditLogs.entityType, query.entityType));
    if (query.entityId) filters.push(eq(auditLogs.entityId, query.entityId));
    if (query.action) filters.push(eq(auditLogs.action, query.action));
    if (query.from) filters.push(gte(auditLogs.createdAt, query.from));
    if (query.to) filters.push(lte(auditLogs.createdAt, query.to));

    return filters;
}

/**
 * Paginated, filtered, sorted list of ONE user's audit rows, plus the total
 * matching count. Backs GET /audit.
 */
export async function findAllForUser(
    userId: string,
    query: ListAuditQuery,
): Promise<{ rows: AuditLogRow[]; total: number }> {
    const where = and(...buildFilters(userId, query));

    const sortColumn = SORTABLE_COLUMNS[query.sortBy];
    const orderBy = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const rows = await db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(orderBy)
        .limit(query.limit)
        .offset((query.page - 1) * query.limit);

    const [countRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(where);

    return { rows, total: countRow?.total ?? 0 };
}

/**
 * Fetch a single audit row that BELONGS TO `userId`.
 *
 * The owner check is part of the query, so a row owned by someone else simply
 * does not exist as far as this caller is concerned — the service turns that
 * into a 404 rather than a 403, which avoids confirming that the id is real.
 */
export async function findByIdForUser(
    id: string,
    userId: string,
): Promise<AuditLogRow | undefined> {
    const [row] = await db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.id, id), eq(auditLogs.userId, userId)))
        .limit(1);

    return row;
}
