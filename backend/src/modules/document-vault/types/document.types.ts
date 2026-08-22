import { documentOwnerEnum, documentSourceEnum, documentTypeEnum } from "../../../db/schema";

/**
 * The set of entities a document can belong to. Sourced directly from the
 * `document_owner` Postgres enum so this type can never drift out of sync
 * with the schema. Adding a genuinely new entity type (e.g. "COLLECTION")
 * requires a schema migration on that enum — this module cannot invent one.
 */
export type EntityType = (typeof documentOwnerEnum.enumValues)[number];

/** The set of document classifications, sourced from the `document_type` Postgres enum. */
export type DocumentClassification = (typeof documentTypeEnum.enumValues)[number];

/**
 * Which surface produced a document, sourced from the `document_source` enum.
 * IDENTITY rows come from an entity's own identity fields; GENERAL rows come
 * from the generic Documents page. document_type alone cannot separate them - a
 * PAN card can legitimately arrive from either - so callers that need only one
 * kind must filter on this.
 */
export type DocumentSource = (typeof documentSourceEnum.enumValues)[number];

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
    /** Defaults to DEFAULT_DOCUMENT_SOURCE ("GENERAL") when omitted. */
    source?: string;
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
    source: DocumentSource;
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

export interface DownloadResult {
    buffer: Buffer;
    metadata: DocumentMetadata;
}

export interface SignedUrlResult {
    url: string;
    expiresAt: Date;
}
