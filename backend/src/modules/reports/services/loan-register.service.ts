import { and, desc, eq, isNull, type SQL } from "drizzle-orm";

import { db } from "../../../db";
import { loans, borrowers } from "../../../db/schema";
import { getLoanSnapshots } from "../../ledger/snapshot.service";

import { buildDateRangeConditions } from "../utils/query.util";
import type { LoanRegisterRow, ReportFilters } from "../types/report.types";

/** One row per live loan. Every money figure is the loan's ledger snapshot, as on the Loans list. */
export async function getLoanRegister(filters: ReportFilters): Promise<LoanRegisterRow[]> {
    const conditions: SQL[] = [isNull(loans.deletedAt)];

    if (filters.loanStatus) {
        conditions.push(eq(loans.status, filters.loanStatus));
    }

    if (filters.customerId) {
        conditions.push(eq(loans.borrowerId, filters.customerId));
    }

    conditions.push(
        ...buildDateRangeConditions(loans.createdAt, filters.startDate, filters.endDate),
    );

    const rows = await db
        .select({
            id: loans.id,
            loanNumber: loans.loanAccountNumber,
            customerName: borrowers.name,
            loanAmount: loans.sanctionedAmount,
            interestRate: loans.interestRate,
            status: loans.status,
            createdDate: loans.createdAt,
        })
        .from(loans)
        .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
        .where(and(...conditions))
        .orderBy(desc(loans.createdAt));

    const snapshots = await getLoanSnapshots(rows.map((r) => r.id));

    return rows.map(({ id, ...row }) => {
        const s = snapshots.get(id)!;
        return {
            ...row,
            disbursedAmount: s.totalDisbursed,
            outstandingAmount: s.principalOutstanding,
            interestDue: s.interestOutstanding,
            totalPayable: s.totalPayable,
            amountOverdue: s.amountOverdue,
            dpd: s.dpd,
            classification: s.classification,
            createdDate: row.createdDate ? row.createdDate.toISOString() : null,
        };
    });
}
