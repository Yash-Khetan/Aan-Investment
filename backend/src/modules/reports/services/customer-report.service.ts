import { and, eq, isNull, type SQL } from "drizzle-orm";

import { db } from "../../../db";
import { borrowers, loans } from "../../../db/schema";
import { getLoanSnapshots } from "../../ledger/snapshot.service";

import { buildDateRangeConditions } from "../utils/query.util";
import type { CustomerReportRow, ReportFilters } from "../types/report.types";

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * One row per live borrower, with the loans in scope summed from their
 * ledger snapshots — so a customer's total is exactly the sum of their loans
 * on the Loans list.
 */
export async function getCustomerReport(filters: ReportFilters): Promise<CustomerReportRow[]> {
    const loanConditions: SQL[] = [eq(loans.borrowerId, borrowers.id), isNull(loans.deletedAt)];

    if (filters.loanStatus) {
        loanConditions.push(eq(loans.status, filters.loanStatus));
    }

    loanConditions.push(
        ...buildDateRangeConditions(loans.createdAt, filters.startDate, filters.endDate),
    );

    const borrowerConditions: SQL[] = [isNull(borrowers.deletedAt)];

    if (filters.customerId) {
        borrowerConditions.push(eq(borrowers.id, filters.customerId));
    }

    const rows = await db
        .select({
            customerId: borrowers.id,
            customerName: borrowers.name,
            phone: borrowers.phone,
            email: borrowers.email,
            loanId: loans.id,
        })
        .from(borrowers)
        .leftJoin(loans, and(...loanConditions))
        .where(and(...borrowerConditions))
        .orderBy(borrowers.name);

    const loanIds = rows.flatMap((r) => (r.loanId ? [r.loanId] : []));
    const snapshots = await getLoanSnapshots(loanIds);

    const byCustomer = new Map<string, CustomerReportRow>();
    for (const { loanId, ...customer } of rows) {
        const entry = byCustomer.get(customer.customerId) ?? {
            ...customer,
            totalLoans: 0,
            outstandingAmount: 0,
            totalPayable: 0,
            amountOverdue: 0,
        };
        if (loanId) {
            const s = snapshots.get(loanId)!;
            entry.totalLoans += 1;
            entry.outstandingAmount = round2(entry.outstandingAmount + s.principalOutstanding);
            entry.totalPayable = round2(entry.totalPayable + s.totalPayable);
            entry.amountOverdue = round2(entry.amountOverdue + s.amountOverdue);
        }
        byCustomer.set(customer.customerId, entry);
    }

    return [...byCustomer.values()];
}
