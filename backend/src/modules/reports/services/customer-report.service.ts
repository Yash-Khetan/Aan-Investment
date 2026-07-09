import { and, count, eq, sum, type SQL } from "drizzle-orm";

import { db } from "../../../db";
import { borrowers, loans } from "../../../db/schema";

import { buildDateRangeConditions } from "../utils/query.util";
import type { CustomerReportRow, ReportFilters } from "../types/report.types";

export async function getCustomerReport(filters: ReportFilters): Promise<CustomerReportRow[]> {
    const loanConditions: SQL[] = [eq(loans.borrowerId, borrowers.id)];

    if (filters.loanStatus) {
        loanConditions.push(eq(loans.status, filters.loanStatus));
    }

    loanConditions.push(
        ...buildDateRangeConditions(loans.createdAt, filters.startDate, filters.endDate),
    );

    const borrowerConditions: SQL[] = [];

    if (filters.customerId) {
        borrowerConditions.push(eq(borrowers.id, filters.customerId));
    }

    const rows = await db
        .select({
            customerId: borrowers.id,
            customerName: borrowers.name,
            phone: borrowers.phone,
            email: borrowers.email,
            totalLoans: count(loans.id),
            outstandingAmount: sum(loans.outstandingPrincipal),
        })
        .from(borrowers)
        .leftJoin(loans, and(...loanConditions))
        .where(borrowerConditions.length > 0 ? and(...borrowerConditions) : undefined)
        .groupBy(borrowers.id, borrowers.name, borrowers.phone, borrowers.email)
        .orderBy(borrowers.name);

    return rows.map((row) => ({
        ...row,
        outstandingAmount: row.outstandingAmount ?? "0",
    }));
}
