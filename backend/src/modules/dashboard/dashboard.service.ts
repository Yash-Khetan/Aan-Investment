import { and, count, gte, inArray, isNull, lt, lte, sql, sum } from "drizzle-orm";

import { db } from "../../db/index.js";
import { collectionCases, installments, loans } from "../../db/schema/index.js";

function toNumber(value: string | null): number {
    return value === null ? 0 : Number(value);
}

function todayISODate(): string {
    return new Date().toISOString().slice(0, 10);
}

export async function getPortfolioSummary() {
    const byStatus = await db
        .select({
            status: loans.status,
            loanCount: count(),
            sanctionedAmount: sum(loans.sanctionedAmount),
            disbursedAmount: sum(loans.disbursedAmount),
            outstandingPrincipal: sum(loans.outstandingPrincipal),
        })
        .from(loans)
        .where(isNull(loans.deletedAt))
        .groupBy(loans.status);

    const totals = byStatus.reduce(
        (acc, row) => {
            acc.totalLoans += row.loanCount;
            acc.totalSanctioned += toNumber(row.sanctionedAmount);
            acc.totalDisbursed += toNumber(row.disbursedAmount);
            acc.totalOutstanding += toNumber(row.outstandingPrincipal);
            return acc;
        },
        { totalLoans: 0, totalSanctioned: 0, totalDisbursed: 0, totalOutstanding: 0 },
    );

    return {
        totals,
        byStatus: byStatus.map((row) => ({
            status: row.status,
            loanCount: row.loanCount,
            sanctionedAmount: toNumber(row.sanctionedAmount),
            disbursedAmount: toNumber(row.disbursedAmount),
            outstandingPrincipal: toNumber(row.outstandingPrincipal),
        })),
    };
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
