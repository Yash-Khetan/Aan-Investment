import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, ValidationError } from "../common/errors";
import { config } from "../config";

/**
 * Global error handler — the LAST middleware registered.
 *
 * Express identifies an error handler by its FOUR-argument signature
 * (err, req, res, next). Any error passed to `next(err)`, or thrown from an
 * async handler (Express 5 forwards rejected promises automatically), lands
 * here. This is the single funnel through which every failure leaves the app,
 * guaranteeing one consistent error response shape.
 *
 * We log via `req.log` (pino-http's per-request child logger) so the error line
 * is automatically tagged with the request id set by the request logger.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    const requestId = req.id;

    // Normalize a raw ZodError (thrown outside `validate`) into our shape.
    const normalized =
        err instanceof ZodError
            ? new ValidationError(
                  "Validation failed",
                  err.issues.map((i) => ({
                      field: i.path.join(".") || "(root)",
                      message: i.message,
                  })),
              )
            : err;

    // Expected, operational failures → describe them honestly to the client.
    if (normalized instanceof AppError && normalized.isOperational) {
        res.status(normalized.statusCode).json({
            success: false,
            error: {
                message: normalized.message,
                ...(normalized.details !== undefined
                    ? { details: normalized.details }
                    : {}),
                requestId,
            },
        });
        return;
    }

    // Everything else is an unexpected bug. Log full detail server-side...
    req.log.error({ err: normalized }, "Unhandled error");

    // ...but never leak internals to the client in production.
    res.status(500).json({
        success: false,
        error: {
            message: config.isProduction
                ? "Internal Server Error"
                : normalized instanceof Error
                    ? normalized.message
                    : "Unknown error",
            requestId,
            ...(config.isProduction
                ? {}
                : {
                      stack:
                          normalized instanceof Error
                              ? normalized.stack
                              : undefined,
                  }),
        },
    });
};
