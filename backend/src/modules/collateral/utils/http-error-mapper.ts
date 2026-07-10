import type { Response } from "express";
import {
    CollateralError,
    CollateralNotFoundError,
    LoanNotFoundError,
    InvalidCollateralTypeError,
    ValidationError,
    DuplicateCollateralError,
    LtvCalculationError,
    CollateralPersistenceError,
} from "./errors";

const STATUS_BY_ERROR = new Map<Function, number>([
    [CollateralNotFoundError, 404],
    [LoanNotFoundError, 404],
    [InvalidCollateralTypeError, 400],
    [ValidationError, 400],
    [DuplicateCollateralError, 409],
    [LtvCalculationError, 422],
    [CollateralPersistenceError, 500],
]);

/** Maps a collateral-module error to an HTTP response. Keeps error handling self-contained within this module. */
export function mapErrorToHttpResponse(res: Response, error: unknown): void {
    if (error instanceof CollateralError) {
        const status = STATUS_BY_ERROR.get(error.constructor) ?? 500;
        res.status(status).json({ error: error.name, message: error.message });
        return;
    }

    console.error("[Collateral] Unexpected error:", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "InternalServerError", message: "An unexpected error occurred." });
}
