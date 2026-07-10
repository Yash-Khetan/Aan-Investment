/* ============================================================
   TYPED HTTP ERRORS
   Thrown from validators/services and translated into a
   consistent JSON error shape by error-handler.middleware.ts.
============================================================ */

export class AccountingExportError extends Error {
    public readonly statusCode: number;
    public readonly code: string;

    constructor(statusCode: number, code: string, message: string) {
        super(message);
        this.name = "AccountingExportError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

export class ValidationError extends AccountingExportError {
    constructor(message: string) {
        super(400, "VALIDATION_ERROR", message);
        this.name = "ValidationError";
    }
}

export class NoDataFoundError extends AccountingExportError {
    constructor(message = "No accounting entries found for the given filters.") {
        super(404, "NO_DATA_FOUND", message);
        this.name = "NoDataFoundError";
    }
}

export class DatabaseQueryError extends AccountingExportError {
    constructor(message = "Failed to read accounting data from the database.") {
        super(502, "DATABASE_ERROR", message);
        this.name = "DatabaseQueryError";
    }
}
