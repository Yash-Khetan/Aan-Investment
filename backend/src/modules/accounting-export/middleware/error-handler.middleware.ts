import type { NextFunction, Request, Response } from "express";

import { AccountingExportError } from "../utils/http-error.utils.js";
import { logger } from "../utils/logger.utils.js";

/* ============================================================
   CENTRALIZED ERROR HANDLER
   Must be registered last on the router (4-arg signature is what
   Express uses to identify error middleware).
============================================================ */

export function errorHandlerMiddleware(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
): void {
    if (err instanceof AccountingExportError) {
        logger.warn("Export request failed", {
            path: req.path,
            code: err.code,
            statusCode: err.statusCode,
        });

        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
            },
        });
        return;
    }

    const message = err instanceof Error ? err.message : "Unknown error";

    logger.error("Unhandled error in accounting-export module", {
        path: req.path,
        message,
    });

    res.status(500).json({
        success: false,
        error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while processing the export.",
        },
    });
}
