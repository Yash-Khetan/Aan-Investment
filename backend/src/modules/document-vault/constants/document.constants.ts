/** Private Supabase Storage bucket that all document-vault objects live in. */
export const BUCKET_NAME = "Aan_documents";

/** Maximum accepted upload size, in bytes. */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/** MIME types accepted by uploadSingleFile / DocumentService.upload. */
export const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/** Default lifetime of a generated signed URL when the caller doesn't specify one. */
export const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

/** documentType used when a caller doesn't classify the upload. */
export const DEFAULT_DOCUMENT_TYPE = "OTHER";
