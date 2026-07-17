import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import { db } from "../../../db";
import { collectionCases, followUps, loans, borrowers, users } from "../../../db/schema";

import { buildDateRangeConditions } from "../utils/query.util";
import type { CollectionsReportRow, ReportFilters } from "../types/report.types";

export async function getCollectionsReport(
    filters: ReportFilters,
): Promise<CollectionsReportRow[]> {
    // Most recent follow-up per collection case, used to surface the
    // latest promise-to-pay date without an N+1 lookup per case.
    const latestFollowUp = db
        .selectDistinctOn([followUps.collectionCaseId], {
            collectionCaseId: followUps.collectionCaseId,
            promiseDate: followUps.promiseDate,
        })
        .from(followUps)
        .orderBy(followUps.collectionCaseId, desc(followUps.followUpDate))
        .as("latest_follow_up");

    const conditions: SQL[] = [];

    if (filters.collectionStatus) {
        conditions.push(eq(collectionCases.status, filters.collectionStatus));
    }

    if (filters.loanStatus) {
        conditions.push(eq(loans.status, filters.loanStatus));
    }

    if (filters.customerId) {
        conditions.push(eq(collectionCases.borrowerId, filters.customerId));
    }

    conditions.push(
        ...buildDateRangeConditions(collectionCases.createdAt, filters.startDate, filters.endDate),
    );

    const rows = await db
        .select({
            loanNumber: loans.loanAccountNumber,
            customerName: borrowers.name,
            collectionStatus: collectionCases.status,
            promiseToPay: latestFollowUp.promiseDate,
            nextFollowUp: collectionCases.nextFollowUpDate,
            assignedUser: sql<string | null>`trim(concat(${users.firstName}, ' ', coalesce(${users.lastName}, '')))`,
        })
        .from(collectionCases)
        .innerJoin(loans, eq(collectionCases.loanId, loans.id))
        .innerJoin(borrowers, eq(collectionCases.borrowerId, borrowers.id))
        .leftJoin(users, eq(collectionCases.assignedTo, users.id))
        .leftJoin(latestFollowUp, eq(latestFollowUp.collectionCaseId, collectionCases.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(collectionCases.createdAt));

    return rows.map((row) => ({
        ...row,
        assignedUser: row.assignedUser || null,
    }));
}
