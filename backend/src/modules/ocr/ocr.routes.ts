import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import { uploadSingleFile } from "./ocr.middleware";
import { extract } from "./ocr.controller";

/**
 * ocrRouter — mounted at /ocr.
 *   POST /extract   OCR a PAN/GSTIN/Aadhaar image, return a best-effort extracted value
 */
export const ocrRouter = Router();

ocrRouter.post("/extract", authenticate, uploadSingleFile, extract);
