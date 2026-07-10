import type { RequestHandler } from "express";

import { NotFoundError } from "../errors/AppError";

/** Catch-all for unmatched routes; forwards a 404 to the error handler. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
    next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
};
