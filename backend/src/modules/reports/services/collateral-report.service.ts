import { and, desc, eq, type SQL } from "drizzle-orm";

import { db } from "../../../db";
import { collaterals, collateralInsurance, loans, borrowers } from "../../../db/schema";

import { buildDateRangeConditions } from "../utils/query.util";
import type {
    CollateralReportRow,
    InsuranceStatus,
    ReportFilters,
} from "../types/report.types";

function resolveInsuranceStatus(
    status: (typeof collateralInsurance.$inferSelect)["status"] | null | undefined,
    expiryDate: string | null | undefined,
): InsuranceStatus {
    if (!status) {
        return "NOT_INSURED";
    }

    if (status === "INACTIVE") {
        return "INACTIVE";
    }

    if (expiryDate && new Date(expiryDate).getTime() < Date.now()) {
        return "EXPIRED";
    }

    return "ACTIVE";
}

export async function getCollateralReport(
    filters: ReportFilters,
): Promise<CollateralReportRow[]> {
    // Most recent insurance policy per collateral (by expiry date), avoiding
    // an N+1 lookup by resolving it as a single joined subquery.
    const latestInsurance = db
        .selectDistinctOn([collateralInsurance.collateralId], {
            collateralId: collateralInsurance.collateralId,
            status: collateralInsurance.status,
            expiryDate: collateralInsurance.expiryDate,
        })
        .from(collateralInsurance)
        .orderBy(collateralInsurance.collateralId, desc(collateralInsurance.expiryDate))
        .as("latest_insurance");

    const conditions: SQL[] = [];

    if (filters.collateralType) {
        conditions.push(eq(collaterals.securityType, filters.collateralType));
    }

    if (filters.loanStatus) {
        conditions.push(eq(loans.status, filters.loanStatus));
    }

    if (filters.customerId) {
        conditions.push(eq(loans.borrowerId, filters.customerId));
    }

    conditions.push(
        ...buildDateRangeConditions(collaterals.createdAt, filters.startDate, filters.endDate),
    );

    const rows = await db
        .select({
            collateralType: collaterals.securityType,
            loanNumber: loans.loanAccountNumber,
            marketValue: collaterals.estimatedValue,
            ltv: collaterals.ltvRatio,
            insuranceStatus: latestInsurance.status,
            insuranceExpiryDate: latestInsurance.expiryDate,
        })
        .from(collaterals)
        .innerJoin(loans, eq(collaterals.loanId, loans.id))
        .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
        .leftJoin(latestInsurance, eq(latestInsurance.collateralId, collaterals.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(collaterals.createdAt));

    return rows.map((row) => ({
        collateralType: row.collateralType,
        loanNumber: row.loanNumber,
        marketValue: row.marketValue,
        forcedSaleValue: null,
        ltv: row.ltv,
        insuranceStatus: resolveInsuranceStatus(row.insuranceStatus, row.insuranceExpiryDate),
    }));
}
