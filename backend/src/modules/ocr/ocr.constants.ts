/** OCR (Tesseract) reads pixels, not PDF text layers — image formats only, for now. */
export const OCR_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Same ceiling as the document-vault upload, so a file that's valid to upload is valid to OCR. */
export const OCR_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const OCR_SUPPORTED_DOCUMENT_TYPES = ["PAN_CARD", "GSTIN_CERTIFICATE", "AADHAAR"] as const;
