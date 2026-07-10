import { and, eq, sql, type SQL } from "drizzle-orm";

import { db } from "../../../db";
import { loans } from "../../../db/schema";

import { buildDateRangeConditions } from "../utils/query.util";
import type { PortfolioSummaryRow, ReportFilters } from "../types/report.types";

export async function getPortfolioSummary(
    filters: ReportFilters,
): Promise<PortfolioSummaryRow> {
    const conditions: SQL[] = [];

    if (filters.customerId) {
        conditions.push(eq(loans.borrowerId, filters.customerId));
    }

    conditions.push(
        ...buildDateRangeConditions(loans.createdAt, filters.startDate, filters.endDate),
    );

    const [row] = await db
        .select({
            totalLoans: sql<number>`count(*)`.mapWith(Number),
            activeLoans: sql<number>`count(*) filter (where ${loans.status} = 'ACTIVE')`.mapWith(
                Number,
            ),
            closedLoans: sql<number>`count(*) filter (where ${loans.status} = 'CLOSED')`.mapWith(
                Number,
            ),
            // `loan_status` has no REJECTED value in the current schema (see
            // README "Known schema gaps"); casting to text keeps the query
            // valid and this always evaluates to 0 until the enum adds it.
            rejectedLoans: sql<number>`count(*) filter (where ${loans.status}::text = 'REJECTED')`.mapWith(
                Number,
            ),
            totalPortfolioValue: sql<string>`coalesce(sum(${loans.sanctionedAmount}), 0)`,
            outstandingAmount: sql<string>`coalesce(sum(${loans.outstandingPrincipal}), 0)`,
            averageLoanSize: sql<string>`coalesce(avg(${loans.sanctionedAmount}), 0)`,
            averageInterestRate: sql<string>`coalesce(avg(${loans.interestRate}), 0)`,
        })
        .from(loans)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

    return row;
}
