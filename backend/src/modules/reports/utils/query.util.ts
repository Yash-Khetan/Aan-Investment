import { gte, lte, type SQL, type Column } from "drizzle-orm";

/**
 * Builds inclusive [startDate, endDate] range conditions against a
 * timestamp/date column, skipping bounds that were not supplied.
 */
export function buildDateRangeConditions(
    column: Column,
    startDate?: string,
    endDate?: string,
): SQL[] {
    const conditions: SQL[] = [];

    if (startDate) {
        conditions.push(gte(column, new Date(`${startDate}T00:00:00.000Z`)));
    }

    if (endDate) {
        conditions.push(lte(column, new Date(`${endDate}T23:59:59.999Z`)));
    }

    return conditions;
}
