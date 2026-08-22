/**
 * Custom error hierarchy for the document-vault module.
 * Consumers can catch `DocumentVaultError` to handle any vault failure
 * generically, or catch a specific subclass to react to a particular
 * failure mode (validation, missing document, storage/db failure).
 */

export class DocumentVaultError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = "DocumentVaultError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** Thrown when `entityType` isn't a value of the `document_owner` enum. */
export class InvalidEntityTypeError extends DocumentVaultError {
    constructor(message: string) {
        super(message);
        this.name = "InvalidEntityTypeError";
    }
}

/** Thrown when `entityId` isn't a valid UUID. */
export class InvalidEntityIdError extends DocumentVaultError {
    constructor(message: string) {
        super(message);
        this.name = "InvalidEntityIdError";
    }
}

/** Thrown when `documentType` isn't a value of the `document_type` enum. */
export class InvalidDocumentTypeError extends DocumentVaultError {
    constructor(message: string) {
        super(message);
        this.name = "InvalidDocumentTypeError";
    }
}

/** Thrown when an uploaded file's MIME type isn't in the allow-list. */
export class InvalidMimeTypeError extends DocumentVaultError {
    constructor(message: string) {
        super(message);
        this.name = "InvalidMimeTypeError";
    }
}

/** Thrown when an uploaded file exceeds MAX_FILE_SIZE_BYTES. */
export class FileTooLargeError extends DocumentVaultError {
    constructor(message: string) {
        super(message);
        this.name = "FileTooLargeError";
    }
}

/** Thrown when an upload request has no file attached. */
export class MissingFileError extends DocumentVaultError {
    constructor(message: string) {
        super(message);
        this.name = "MissingFileError";
    }
}

/** Thrown when a requested document id doesn't resolve to an active row. */
export class DocumentNotFoundError extends DocumentVaultError {
    constructor(message: string) {
        super(message);
        this.name = "DocumentNotFoundError";
    }
}

/** Thrown when a Supabase Storage operation (upload/download/remove/sign) fails. */
export class StorageError extends DocumentVaultError {
    constructor(message: string, cause?: unknown) {
        super(message, cause);
        this.name = "StorageError";
    }
}

/** Thrown when a database read/write against the `documents` table fails. */
export class DocumentPersistenceError extends DocumentVaultError {
    constructor(message: string, cause?: unknown) {
        super(message, cause);
        this.name = "DocumentPersistenceError";
    }
}
