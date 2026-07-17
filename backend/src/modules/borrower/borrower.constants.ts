import { borrowers } from "../../db/schema";

/** Pagination defaults and bounds for borrower listing. */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const DEFAULT_SORT_ORDER = "desc" as const;

/**
 * Whitelist of columns a client may sort by, mapped to the actual Drizzle
 * column. Prevents ORDER BY injection and sorting on arbitrary fields.
 */
export const SORTABLE_COLUMNS = {
    createdAt: borrowers.createdAt,
    updatedAt: borrowers.updatedAt,
    name: borrowers.name,
    borrowerCode: borrowers.borrowerCode,
    status: borrowers.status,
} as const;

export type SortableColumn = keyof typeof SORTABLE_COLUMNS;

export const DEFAULT_SORT_BY: SortableColumn = "createdAt";
