import { z } from "zod";
import { OCR_SUPPORTED_DOCUMENT_TYPES } from "./ocr.constants";

export const extractRequestSchema = z.object({
    documentType: z.enum(OCR_SUPPORTED_DOCUMENT_TYPES),
});
