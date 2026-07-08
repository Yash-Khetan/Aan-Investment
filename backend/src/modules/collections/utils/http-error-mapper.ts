import type { Response } from "express";
import {
    CollectionsError,
    CollectionActivityNotFoundError,
    LoanNotFoundError,
    CustomerNotFoundError,
    ValidationError,
    InvalidActivityTypeError,
    InvalidStatusError,
    InvalidPromiseToPayStateError,
    CollectionsPersistenceError,
} from "./errors";

const STATUS_BY_ERROR = new Map<Function, number>([
    [CollectionActivityNotFoundError, 404],
    [LoanNotFoundError, 404],
    [CustomerNotFoundError, 404],
    [ValidationError, 400],
    [InvalidActivityTypeError, 400],
    [InvalidStatusError, 400],
    [InvalidPromiseToPayStateError, 409],
    [CollectionsPersistenceError, 500],
]);

/** Maps a collections-module error to an HTTP response. Keeps error handling self-contained within this module. */
export function mapErrorToHttpResponse(res: Response, error: unknown): void {
    if (error instanceof CollectionsError) {
        const status = STATUS_BY_ERROR.get(error.constructor) ?? 500;
        res.status(status).json({ error: error.name, message: error.message });
        return;
    }

    console.error("[Collections] Unexpected error:", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "InternalServerError", message: "An unexpected error occurred." });
}
