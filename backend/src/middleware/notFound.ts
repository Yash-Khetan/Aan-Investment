import type { RequestHandler } from "express";
import { NotFoundError } from "../common/errors";

/**
 * Catch-all for unmatched routes.
 *
 * Registered AFTER all real routes. If a request reaches here, no route claimed
 * it, so we forward a NotFoundError into the error pipeline rather than letting
 * Express send its default HTML 404. This keeps every response — success or
 * failure — in one consistent JSON shape.
 */
export const notFound: RequestHandler = (req, _res, next) => {
    next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
};
