export class OcrError extends Error {
    constructor(message: string, public override readonly cause?: unknown) {
        super(message);
        this.name = "OcrError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** Thrown when the uploaded file's MIME type isn't a supported image format. */
export class UnsupportedFileTypeError extends OcrError {
    constructor(message: string) {
        super(message);
        this.name = "UnsupportedFileTypeError";
    }
}

/** Thrown when an OCR request has no file attached. */
export class MissingFileError extends OcrError {
    constructor(message: string) {
        super(message);
        this.name = "MissingFileError";
    }
}
