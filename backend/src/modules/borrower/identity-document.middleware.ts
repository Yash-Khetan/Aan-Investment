import multer from "multer";

import { MAX_FILE_SIZE_BYTES } from "./identity-document.storage";

/**
 * Parses a single multipart upload (field name "file") into memory as
 * req.file.buffer. Kept in this module so borrower identity uploads do not
 * depend on the document-vault module's middleware.
 */
export const uploadIdentityFile = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single("file");
