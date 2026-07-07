import { documentOwnerEnum, documentTypeEnum } from "../../../db/schema";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "../constants/document.constants";
import {
    InvalidEntityTypeError,
    InvalidEntityIdError,
    InvalidDocumentTypeError,
    InvalidMimeTypeError,
    FileTooLargeError,
    MissingFileError,
} from "../utils/errors";
import type { EntityType, DocumentClassification, UploadFileInput } from "../types/document.types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertValidEntityType(entityType: string): asserts entityType is EntityType {
    if (!documentOwnerEnum.enumValues.includes(entityType as EntityType)) {
        throw new InvalidEntityTypeError(
            `Invalid entityType "${entityType}". Must be one of: ${documentOwnerEnum.enumValues.join(", ")}.`
        );
    }
}

export function assertValidEntityId(entityId: string): void {
    if (!entityId || !UUID_REGEX.test(entityId)) {
        throw new InvalidEntityIdError(`Invalid entityId "${entityId}". Must be a valid UUID.`);
    }
}

export function assertValidDocumentType(documentType: string): asserts documentType is DocumentClassification {
    if (!documentTypeEnum.enumValues.includes(documentType as DocumentClassification)) {
        throw new InvalidDocumentTypeError(
            `Invalid documentType "${documentType}". Must be one of: ${documentTypeEnum.enumValues.join(", ")}.`
        );
    }
}

export function assertFilePresent(file: UploadFileInput | undefined | null): asserts file is UploadFileInput {
    if (!file || !file.buffer || file.buffer.length === 0) {
        throw new MissingFileError("No file was provided in the request.");
    }
}

export function assertValidMimeType(mimeType: string): void {
    if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
        throw new InvalidMimeTypeError(
            `Invalid MIME type "${mimeType}". Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}.`
        );
    }
}

export function assertValidFileSize(sizeBytes: number): void {
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
        throw new FileTooLargeError(
            `File size ${sizeBytes} bytes exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES} bytes.`
        );
    }
}
