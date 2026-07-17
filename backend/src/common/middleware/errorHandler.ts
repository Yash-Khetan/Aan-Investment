import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { AppError } from "../errors/AppError";
import { isProduction } from "../../config/env";

interface ErrorBody {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}

/**
 * Global error handler. Converts known error types into a consistent envelope:
 *   - ZodError            -> 422 with flattened field errors
 *   - AppError subclasses -> their declared statusCode/code
 *   - everything else     -> 500 (message hidden in production)
 */
export const errorHandler = (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    if (err instanceof ZodError) {
        const body: ErrorBody = {
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: "Validation failed",
                details: err.flatten(),
            },
        };
        res.status(422).json(body);
        return;
    }

    if (err instanceof AppError) {
        const body: ErrorBody = {
            success: false,
            error: {
                code: err.code,
                message: err.message,
                ...(err.details !== undefined
                    ? { details: err.details }
                    : {}),
            },
        };
        res.status(err.statusCode).json(body);
        return;
    }

    // Unexpected error: log for diagnostics, hide internals from the client.
    console.error("Unhandled error:", err);
    const body: ErrorBody = {
        success: false,
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: isProduction
                ? "An unexpected error occurred"
                : err instanceof Error
                  ? err.message
                  : "Unknown error",
        },
    };
    res.status(500).json(body);
};
