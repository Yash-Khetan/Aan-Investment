import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { MAX_FILE_SIZE_BYTES } from "../constants/document.constants";
import { FileTooLargeError } from "../utils/errors";
import { mapErrorToHttpResponse } from "../utils/http-error-mapper";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single("file");

/** Parses a single multipart file upload (field name "file") into memory as req.file.buffer. */
export function uploadSingleFile(req: Request, res: Response, next: NextFunction): void {
    upload(req, res, (error: unknown) => {
        if (!error) {
            next();
            return;
        }

        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            mapErrorToHttpResponse(
                res,
                new FileTooLargeError(`File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES} bytes.`)
            );
            return;
        }

        mapErrorToHttpResponse(res, error);
    });
}
