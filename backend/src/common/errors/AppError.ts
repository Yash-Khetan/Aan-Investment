/**
 * AppError — the base class for every EXPECTED (operational) failure.
 *
 * "Operational" = a failure we anticipated and can translate into a clean HTTP
 * response: bad input, missing resource, unauthorized, conflict, etc.
 *
 * Anything NOT derived from AppError (a TypeError, a null deref, a driver crash)
 * is treated as a programmer error / bug: the global error handler logs it in
 * full and returns a generic 500 so we never leak internals to clients.
 */
export class AppError extends Error {
    /** HTTP status code to send to the client. */
    public readonly statusCode: number;

    /** True for expected failures we can safely describe to the client. */
    public readonly isOperational: boolean;

    /** Optional machine-readable extra context (e.g. field validation issues). */
    public readonly details?: unknown;

    constructor(
        message: string,
        statusCode = 500,
        options: { isOperational?: boolean; details?: unknown } = {},
    ) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = options.isOperational ?? true;
        this.details = options.details;

        // Keep the stack trace pointing at the throw site, not this constructor.
        Error.captureStackTrace(this, this.constructor);
    }
}

/* ------------------------------------------------------------------ *
 * Convenience subclasses. Throw these from services/controllers, e.g.
 *   throw new NotFoundError("Loan not found");
 * ------------------------------------------------------------------ */

export class BadRequestError extends AppError {
    constructor(message = "Bad Request", details?: unknown) {
        super(message, 400, { details });
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized", details?: unknown) {
        super(message, 401, { details });
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "Forbidden", details?: unknown) {
        super(message, 403, { details });
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Not Found", details?: unknown) {
        super(message, 404, { details });
    }
}

export class ConflictError extends AppError {
    constructor(message = "Conflict", details?: unknown) {
        super(message, 409, { details });
    }
}

export class ValidationError extends AppError {
    constructor(message = "Validation Failed", details?: unknown) {
        super(message, 422, { details });
    }
}

export class TooManyRequestsError extends AppError {
    constructor(message = "Too Many Requests", details?: unknown) {
        super(message, 429, { details });
    }
}
