import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async route/middleware handler so rejected promises are forwarded
 * to Express' error pipeline instead of crashing the process. Keeps controllers
 * free of repetitive try/catch blocks.
 */
export const asyncHandler = (
    handler: (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => Promise<unknown>,
): RequestHandler => {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
};
