import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import { db } from "../../../db";
import { documents, users } from "../../../db/schema";

import { buildDateRangeConditions } from "../utils/query.util";
import type { DocumentReportRow, ReportFilters } from "../types/report.types";

export async function getDocumentReport(filters: ReportFilters): Promise<DocumentReportRow[]> {
    const conditions: SQL[] = [];

    if (filters.customerId) {
        conditions.push(eq(documents.ownerType, "BORROWER"));
        conditions.push(eq(documents.ownerId, filters.customerId));
    }

    conditions.push(
        ...buildDateRangeConditions(documents.createdAt, filters.startDate, filters.endDate),
    );

    const rows = await db
        .select({
            documentName: documents.name,
            entityType: documents.ownerType,
            entityId: documents.ownerId,
            uploadedBy: sql<string | null>`trim(concat(${users.firstName}, ' ', coalesce(${users.lastName}, '')))`,
            uploadedAt: documents.createdAt,
            fileType: documents.mimeType,
        })
        .from(documents)
        .leftJoin(users, eq(documents.uploadedBy, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(documents.createdAt));

    return rows.map((row) => ({
        ...row,
        uploadedBy: row.uploadedBy || null,
        uploadedAt: row.uploadedAt ? row.uploadedAt.toISOString() : null,
    }));
}
