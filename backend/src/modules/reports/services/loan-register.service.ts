import { and, desc, eq, type SQL } from "drizzle-orm";

import { db } from "../../../db";
import { loans, borrowers } from "../../../db/schema";

import { buildDateRangeConditions } from "../utils/query.util";
import type { LoanRegisterRow, ReportFilters } from "../types/report.types";

export async function getLoanRegister(filters: ReportFilters): Promise<LoanRegisterRow[]> {
    const conditions: SQL[] = [];

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
            loanNumber: loans.loanAccountNumber,
            customerName: borrowers.name,
            loanAmount: loans.sanctionedAmount,
            outstandingAmount: loans.outstandingPrincipal,
            interestRate: loans.interestRate,
            status: loans.status,
            createdDate: loans.createdAt,
        })
        .from(loans)
        .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(loans.createdAt));

    return rows.map((row) => ({
        ...row,
        outstandingAmount: row.outstandingAmount ?? "0",
        createdDate: row.createdDate ? row.createdDate.toISOString() : null,
    }));
}
