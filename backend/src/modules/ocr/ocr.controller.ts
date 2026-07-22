import type { Request, Response } from "express";
import { ZodError } from "zod";
import { extractRequestSchema } from "./ocr.validators";
import { extractDocumentData } from "./ocr.service";
import { OCR_ALLOWED_MIME_TYPES } from "./ocr.constants";
import { MissingFileError, OcrError, UnsupportedFileTypeError } from "./ocr.errors";

export async function extract(req: Request, res: Response): Promise<void> {
    try {
        if (!req.file) {
            throw new MissingFileError("No file was provided in the request.");
        }
        if (!(OCR_ALLOWED_MIME_TYPES as readonly string[]).includes(req.file.mimetype)) {
            throw new UnsupportedFileTypeError(
                "OCR only supports image files (JPEG/PNG/WebP) for now — PDFs aren't read.",
            );
        }

        const { documentType } = extractRequestSchema.parse(req.body);
        const { extractedValue } = await extractDocumentData(req.file.buffer, documentType);

        res.status(200).json({ success: true, data: { extractedValue } });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(422).json({
                success: false,
                error: { code: "VALIDATION_ERROR", message: "Invalid documentType.", details: error.flatten() },
            });
            return;
        }
        if (error instanceof MissingFileError || error instanceof UnsupportedFileTypeError) {
            res.status(400).json({ success: false, error: { code: error.name, message: error.message } });
            return;
        }
        if (error instanceof OcrError) {
            res.status(502).json({ success: false, error: { code: "OCR_FAILED", message: error.message } });
            return;
        }
        res.status(500).json({
            success: false,
            error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." },
        });
    }
}
