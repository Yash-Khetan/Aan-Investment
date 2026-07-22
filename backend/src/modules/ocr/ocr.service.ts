import { createWorker } from "tesseract.js";
import { extractByDocumentType, type OcrDocumentType } from "./ocr.extractors";
import { OcrError } from "./ocr.errors";

/**
 * Runs Tesseract OCR on an image buffer and extracts a PAN/GSTIN/Aadhaar-shaped
 * value from the recognized text. Best-effort only — accuracy depends entirely
 * on image quality (lighting, focus, skew), which is why the upload UI carries
 * a disclaimer asking for a clear, well-lit photo/scan. A worker is spun up
 * and torn down per call rather than pooled: this is a low-volume, occasional
 * action (one call per document upload), not a hot path worth the complexity
 * of keeping a worker warm.
 */
export async function extractDocumentData(
    fileBuffer: Buffer,
    documentType: OcrDocumentType,
): Promise<{ extractedValue: string | null; rawText: string }> {
    const worker = await createWorker("eng");
    try {
        const {
            data: { text },
        } = await worker.recognize(fileBuffer);
        return {
            extractedValue: extractByDocumentType(documentType, text),
            rawText: text,
        };
    } catch (cause) {
        throw new OcrError("OCR recognition failed.", cause);
    } finally {
        await worker.terminate();
    }
}
