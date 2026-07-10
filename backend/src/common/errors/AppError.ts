/**
 * Application error hierarchy.
 *
 * All operational (expected) errors extend AppError so the global error
 * handler can translate them into consistent HTTP responses. Anything that
 * is NOT an AppError is treated as an unexpected 500.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;
    public readonly details?: unknown;

    constructor(
        message: string,
        statusCode: number,
        code: string,
        details?: unknown,
    ) {
        super(message);
        this.name = new.target.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        this.details = details;
        Error.captureStackTrace?.(this, new.target);
    }
}

export class BadRequestError extends AppError {
    constructor(message = "Bad request", details?: unknown) {
        super(message, 400, "BAD_REQUEST", details);
    }
}

export class ValidationError extends AppError {
    constructor(message = "Validation failed", details?: unknown) {
        super(message, 422, "VALIDATION_ERROR", details);
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Resource not found", details?: unknown) {
        super(message, 404, "NOT_FOUND", details);
    }
}

export class ConflictError extends AppError {
    constructor(message = "Resource conflict", details?: unknown) {
        super(message, 409, "CONFLICT", details);
    }
}
