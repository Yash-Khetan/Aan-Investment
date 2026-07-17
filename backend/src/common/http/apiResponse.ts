import type { Response } from "express";

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export interface SuccessBody<T> {
    success: true;
    data: T;
    meta?: PaginationMeta;
}

/**
 * Consistent success envelope used by every controller. Error responses are
 * produced centrally by the error handler, so there is no error variant here.
 */
export const sendSuccess = <T>(
    res: Response,
    data: T,
    statusCode = 200,
    meta?: PaginationMeta,
): Response<SuccessBody<T>> => {
    const body: SuccessBody<T> = { success: true, data };
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
};

export const sendCreated = <T>(res: Response, data: T): Response<SuccessBody<T>> =>
    sendSuccess(res, data, 201);
