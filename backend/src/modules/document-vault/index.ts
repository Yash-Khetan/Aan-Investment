/**
 * Public surface of the document-vault module. Other parts of the
 * application (loans, borrowers, collaterals, collections, ...) should
 * import only from this file, never from internal folders directly.
 */

export { documentRouter } from "./routes/document.routes";
export { DocumentService } from "./services/document.service";

export type {
    EntityType,
    DocumentClassification,
    UploadFileInput,
    UploadDocumentInput,
    DocumentMetadata,
    DownloadResult,
    SignedUrlResult,
} from "./types/document.types";

export {
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
} from "./utils/errors";
