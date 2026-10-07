import { and, eq, isNull, type SQL } from "drizzle-orm";

import { db } from "../../../db";
import { loans } from "../../../db/schema";
import { getLoanSnapshots } from "../../ledger/snapshot.service";
import { getCurrentRates } from "../../interest/interest.repository";

import { buildDateRangeConditions } from "../utils/query.util";
import type { PortfolioSummaryRow, ReportFilters } from "../types/report.types";

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * Portfolio totals over the live loans in scope. Counts come from the loan
 * rows; every money figure is summed from the loans' ledger snapshots, and
 * NPA is the ledger's DPD classification, not the manually set status.
 */
export async function getPortfolioSummary(
    filters: ReportFilters,
): Promise<PortfolioSummaryRow> {
    const conditions: SQL[] = [isNull(loans.deletedAt)];

    if (filters.customerId) {
        conditions.push(eq(loans.borrowerId, filters.customerId));
    }

    conditions.push(
        ...buildDateRangeConditions(loans.createdAt, filters.startDate, filters.endDate),
    );

    const rows = await db
        .select({
            id: loans.id,
            status: loans.status,
            sanctionedAmount: loans.sanctionedAmount,
        })
        .from(loans)
        .where(and(...conditions));

    const ids = rows.map((r) => r.id);
    const [snapshots, rates] = await Promise.all([getLoanSnapshots(ids), getCurrentRates(ids)]);

    let totalSanctioned = 0;
    let rateSum = 0;
    const summary = {
        totalLoans: rows.length,
        activeLoans: 0,
        closedLoans: 0,
        npaLoans: 0,
        totalDisbursed: 0,
        outstandingAmount: 0,
        totalPayable: 0,
        totalOverdue: 0,
    };

    for (const row of rows) {
        const s = snapshots.get(row.id)!;
        if (row.status === "ACTIVE") summary.activeLoans += 1;
        if (row.status === "CLOSED") summary.closedLoans += 1;
        if (s.classification === "NPA") summary.npaLoans += 1;
        totalSanctioned += Number(row.sanctionedAmount);
        rateSum += Number(rates.get(row.id)?.interestRate ?? 0);
        summary.totalDisbursed += s.totalDisbursed;
        summary.outstandingAmount += s.principalOutstanding;
        summary.totalPayable += s.totalPayable;
        summary.totalOverdue += s.amountOverdue;
    }

    const count = rows.length;
    return {
        ...summary,
        totalDisbursed: round2(summary.totalDisbursed),
        outstandingAmount: round2(summary.outstandingAmount),
        totalPayable: round2(summary.totalPayable),
        totalOverdue: round2(summary.totalOverdue),
        totalPortfolioValue: totalSanctioned.toFixed(2),
        averageLoanSize: (count > 0 ? totalSanctioned / count : 0).toFixed(2),
        averageInterestRate: (count > 0 ? rateSum / count : 0).toFixed(4),
    };
}
