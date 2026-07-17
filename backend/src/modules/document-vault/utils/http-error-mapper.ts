import type { Response } from "express";
import {
    DocumentVaultError,
    InvalidEntityTypeError,
    InvalidEntityIdError,
    InvalidDocumentTypeError,
    InvalidMimeTypeError,
    FileTooLargeError,
    MissingFileError,
    DocumentNotFoundError,
    StorageError,
    DocumentPersistenceError,
} from "./errors";

const STATUS_BY_ERROR = new Map<Function, number>([
    [InvalidEntityTypeError, 400],
    [InvalidEntityIdError, 400],
    [InvalidDocumentTypeError, 400],
    [InvalidMimeTypeError, 415],
    [FileTooLargeError, 413],
    [MissingFileError, 400],
    [DocumentNotFoundError, 404],
    [StorageError, 502],
    [DocumentPersistenceError, 500],
]);

/** Maps a document-vault error to an HTTP response. Keeps error handling self-contained within this module. */
export function mapErrorToHttpResponse(res: Response, error: unknown): void {
    if (error instanceof DocumentVaultError) {
        const status = STATUS_BY_ERROR.get(error.constructor) ?? 500;
        res.status(status).json({ error: error.name, message: error.message });
        return;
    }

    console.error("[DocumentVault] Unexpected error:", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "InternalServerError", message: "An unexpected error occurred." });
}
