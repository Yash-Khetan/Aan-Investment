import { and, count, gte, inArray, isNull, lt, lte, sql, sum } from "drizzle-orm";

import { db } from "../../db/index.js";
import { collectionCases, installments, loans } from "../../db/schema/index.js";
import { xirr, xmirr } from "../../common/finance/xirr.js";
import { getPortfolioCashFlows } from "../loan/loan.irr.js";
import { getOutstandingPrincipal } from "../loan/loan.metrics.js";

function toNumber(value: string | null): number {
    return value === null ? 0 : Number(value);
}

function todayISODate(): string {
    return new Date().toISOString().slice(0, 10);
}

export async function getPortfolioSummary() {
    const loanRows = await db
        .select({
            id: loans.id,
            status: loans.status,
            sanctionedAmount: loans.sanctionedAmount,
            disbursedAmount: loans.disbursedAmount,
        })
        .from(loans)
        .where(isNull(loans.deletedAt));

    // Computed, not the raw loans.outstandingPrincipal column — nothing updates
    // it when a payment is recorded, so it drifts stale (see loan.metrics.ts).
    const outstandingByLoan = await getOutstandingPrincipal(loanRows.map((l) => l.id));

    const byStatusMap = new Map<
        string,
        { loanCount: number; sanctionedAmount: number; disbursedAmount: number; outstandingPrincipal: number }
    >();

    for (const loan of loanRows) {
        const status = loan.status ?? "UNKNOWN";
        const row = byStatusMap.get(status) ?? {
            loanCount: 0,
            sanctionedAmount: 0,
            disbursedAmount: 0,
            outstandingPrincipal: 0,
        };
        row.loanCount += 1;
        row.sanctionedAmount += toNumber(loan.sanctionedAmount);
        row.disbursedAmount += toNumber(loan.disbursedAmount);
        row.outstandingPrincipal += outstandingByLoan.get(loan.id) ?? 0;
        byStatusMap.set(status, row);
    }

    const byStatus = [...byStatusMap.entries()].map(([status, row]) => ({ status, ...row }));

    const totals = byStatus.reduce(
        (acc, row) => {
            acc.totalLoans += row.loanCount;
            acc.totalSanctioned += row.sanctionedAmount;
            acc.totalDisbursed += row.disbursedAmount;
            acc.totalOutstanding += row.outstandingPrincipal;
            return acc;
        },
        { totalLoans: 0, totalSanctioned: 0, totalDisbursed: 0, totalOutstanding: 0 },
    );

    return { totals, byStatus };
}

export async function getCollectionsSummary() {
    const today = todayISODate();
    const followUpWindowEnd = new Date();
    followUpWindowEnd.setDate(followUpWindowEnd.getDate() + 7);
    const followUpWindowEndISO = followUpWindowEnd.toISOString().slice(0, 10);

    const byStatus = await db
        .select({
            status: collectionCases.status,
            caseCount: count(),
            overdueAmount: sum(collectionCases.overdueAmount),
        })
        .from(collectionCases)
        .where(isNull(collectionCases.deletedAt))
        .groupBy(collectionCases.status);

    const [upcomingFollowUps] = await db
        .select({ count: count() })
        .from(collectionCases)
        .where(
            and(
                isNull(collectionCases.deletedAt),
                gte(collectionCases.nextFollowUpDate, today),
                lte(collectionCases.nextFollowUpDate, followUpWindowEndISO),
                sql`${collectionCases.status} <> 'CLOSED'`,
            ),
        );

    const [overdueInstallmentsRow] = await db
        .select({
            count: count(),
            overdueAmount: sum(sql`${installments.totalAmount} - ${installments.paidTotal}`),
        })
        .from(installments)
        .where(
            and(
                isNull(installments.deletedAt),
                inArray(installments.status, ["PENDING", "PARTIAL"]),
                lt(installments.dueDate, today),
            ),
        );

    const openCases = byStatus.reduce(
        (acc, row) => (row.status === "CLOSED" ? acc : acc + row.caseCount),
        0,
    );
    const totalOverdueAmount = byStatus.reduce((acc, row) => acc + toNumber(row.overdueAmount), 0);

    return {
        openCases,
        totalOverdueAmount,
        byStatus: byStatus.map((row) => ({
            status: row.status,
            caseCount: row.caseCount,
            overdueAmount: toNumber(row.overdueAmount),
        })),
        upcomingFollowUps: upcomingFollowUps?.count ?? 0,
        overdueInstallments: {
            count: overdueInstallmentsRow?.count ?? 0,
            totalAmount: toNumber(overdueInstallmentsRow?.overdueAmount ?? null),
        },
    };
}

/**
 * Portfolio-wide money-weighted return. IRR is solved from the combined,
 * realized cash-flow series across every non-deleted loan (disbursements
 * out, SUCCESS payments in, plus each loan's current outstanding principal
 * as a final notional inflow — see `loan.irr.ts` for why). MIRR needs a
 * finance/reinvestment rate; per product decision, that's the portfolio's
 * disbursement-weighted-average interest rate applied uniformly, standing in
 * for "each loan's own rate" at the aggregate level.
 */
export async function getOverallReturns() {
    const loanRows = await db
        .select({
            id: loans.id,
            interestRate: loans.interestRate,
            disbursedAmount: loans.disbursedAmount,
        })
        .from(loans)
        .where(isNull(loans.deletedAt));

    if (loanRows.length === 0) {
        return { overallIrr: null, overallMirr: null };
    }

    const loanIds = loanRows.map((l) => l.id);
    const cashFlows = await getPortfolioCashFlows(loanIds);

    let weightedRateSum = 0;
    let totalDisbursed = 0;
    for (const loan of loanRows) {
        const disbursed = toNumber(loan.disbursedAmount);
        weightedRateSum += disbursed * (toNumber(loan.interestRate) / 100);
        totalDisbursed += disbursed;
    }
    const blendedRate = totalDisbursed > 0 ? weightedRateSum / totalDisbursed : 0;

    return {
        overallIrr: xirr(cashFlows),
        overallMirr: xmirr(cashFlows, blendedRate, blendedRate),
    };
}
