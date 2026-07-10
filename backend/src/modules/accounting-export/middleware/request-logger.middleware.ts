import type { NextFunction, Request, Response } from "express";

import { logger } from "../utils/logger.utils.js";

/* ============================================================
   REQUEST LOGGER
   Logs "Export requested" on entry and execution time + status
   on completion. Only logs route metadata — never response body.
============================================================ */

export function requestLoggerMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const startedAt = process.hrtime.bigint();

    logger.info("Export requested", {
        method: req.method,
        path: req.path,
        format: typeof req.query.format === "string" ? req.query.format : undefined,
    });

    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

        logger.info("Export request completed", {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: durationMs.toFixed(2),
        });
    });

    next();
}
