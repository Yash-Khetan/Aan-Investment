import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../../common/errors/AppError";
import { ApiError } from "../utils/api-error.util";
import { reportsLogger } from "../utils/logger.util";

/**
 * Terminal error handler for the reports router. Must be registered
 * with `router.use(reportsErrorHandler)` after all routes so it
 * catches errors from validators, controllers, and services.
 *
 * Recognizes both the reports module's own ApiError (thrown by report
 * services) and the app-wide AppError (thrown by shared middleware like
 * `authenticate`) — otherwise auth/validation failures from shared
 * middleware get mislabeled as unexpected 500s below.
 */
export function reportsErrorHandler(
    err: unknown,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction,
): void {
    if (err instanceof ApiError || err instanceof AppError) {
        reportsLogger.warn("Report request rejected", {
            path: req.originalUrl,
            statusCode: err.statusCode,
            message: err.message,
        });

        res.status(err.statusCode).json({
            success: false,
            error: err.message,
        });
        return;
    }

    const message = err instanceof Error ? err.message : "Unknown error";

    reportsLogger.error("Unhandled error in reports module", {
        path: req.originalUrl,
        message,
    });

    res.status(500).json({
        success: false,
        error: "Failed to process report request due to an internal error.",
    });
}
