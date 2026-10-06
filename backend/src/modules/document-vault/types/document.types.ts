import { documentOwnerEnum, documentTypeEnum } from "../../../db/schema";

/**
 * The set of entities a document can belong to. Sourced directly from the
 * `document_owner` Postgres enum so this type can never drift out of sync
 * with the schema. Adding a genuinely new entity type (e.g. "COLLECTION")
 * requires a schema migration on that enum — this module cannot invent one.
 */
export type EntityType = (typeof documentOwnerEnum.enumValues)[number];

/** The set of document classifications, sourced from the `document_type` Postgres enum. */
export type DocumentClassification = (typeof documentTypeEnum.enumValues)[number];

export interface UploadFileInput {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    size: number;
}

export interface UploadDocumentInput {
    entityType: string;
    entityId: string;
    /** Defaults to DEFAULT_DOCUMENT_TYPE when omitted. */
    documentType?: string;
    /** Display name shown to users; defaults to the original filename. Never used as the storage filename. */
    name?: string;
    remarks?: string;
    uploadedBy?: string;
    file: UploadFileInput;
}

export interface DocumentMetadata {
    id: string;
    entityType: EntityType;
    entityId: string;
    documentType: DocumentClassification;
    name: string;
    fileName: string | null;
    storagePath: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    isVerified: boolean | null;
    verifiedBy: string | null;
    uploadedBy: string | null;
    remarks: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
}

/** Filters for the cross-entity document search. All optional. */
export interface DocumentSearchInput {
    /** The borrower's own documents AND those of every loan they hold. */
    borrowerId?: string;
    /** One loan's documents. */
    loanId?: string;
    documentType?: string;
    /** Matches document name, file name, borrower name or loan account number. */
    search?: string;
    page: number;
    limit: number;
}

/** A document in the cross-entity search, labelled with who it belongs to. */
export interface DocumentSearchRow extends DocumentMetadata {
    borrowerId: string | null;
    borrowerName: string | null;
    loanId: string | null;
    loanAccountNumber: string | null;
}

export interface DocumentSearchResult {
    rows: DocumentSearchRow[];
    total: number;
    page: number;
    limit: number;
}

export interface DownloadResult {
    buffer: Buffer;
    metadata: DocumentMetadata;
}

export interface SignedUrlResult {
    url: string;
    expiresAt: Date;
}
