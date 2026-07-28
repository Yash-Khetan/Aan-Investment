import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { OCR_MAX_FILE_SIZE_BYTES } from "./ocr.constants";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: OCR_MAX_FILE_SIZE_BYTES },
}).single("file");

/** Parses a single multipart file upload (field name "file") into memory as req.file.buffer. */
export function uploadSingleFile(req: Request, res: Response, next: NextFunction): void {
    upload(req, res, (error: unknown) => {
        if (!error) {
            next();
            return;
        }
        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            res.status(413).json({
                success: false,
                error: {
                    code: "FILE_TOO_LARGE",
                    message: `File exceeds the maximum allowed size of ${OCR_MAX_FILE_SIZE_BYTES} bytes.`,
                },
            });
            return;
        }
        res.status(400).json({
            success: false,
            error: { code: "UPLOAD_ERROR", message: error instanceof Error ? error.message : "Upload failed." },
        });
    });
}
