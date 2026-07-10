import type { PaginationMeta } from "./apiResponse";

export interface PaginatedResult<T> {
    rows: T[];
    total: number;
}

/**
 * Builds pagination metadata from the requested page/limit and the total row
 * count returned by the repository.
 */
export const buildPaginationMeta = (
    page: number,
    limit: number,
    total: number,
): PaginationMeta => {
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
    };
};
