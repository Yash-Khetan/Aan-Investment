import { loans } from "../../db/schema";

/** Pagination defaults and bounds for loan listing. */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const DEFAULT_SORT_ORDER = "desc" as const;

/**
 * Whitelist of columns a client may sort by, mapped to the actual Drizzle
 * column. Keeping this explicit prevents sorting on arbitrary/sensitive fields
 * and keeps `ORDER BY` injection-safe.
 */
export const SORTABLE_COLUMNS = {
    createdAt: loans.createdAt,
    updatedAt: loans.updatedAt,
    sanctionDate: loans.sanctionDate,
    maturityDate: loans.maturityDate,
    sanctionedAmount: loans.sanctionedAmount,
    outstandingPrincipal: loans.outstandingPrincipal,
    loanAccountNumber: loans.loanAccountNumber,
    status: loans.status,
} as const;

export type SortableColumn = keyof typeof SORTABLE_COLUMNS;

export const DEFAULT_SORT_BY: SortableColumn = "createdAt";
