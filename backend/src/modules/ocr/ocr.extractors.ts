/**
 * Best-effort pattern matches against raw OCR text (unanchored — the match
 * can be anywhere in the page, surrounded by whatever other text/noise the
 * document has). Not the same regexes used for form validation, which anchor
 * the *entire* trimmed input; here we're searching a whole page of text.
 */

const PAN_IN_TEXT = /[A-Z]{5}[0-9]{4}[A-Z]/;
const GSTIN_IN_TEXT = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]/;
/**
 * Aadhaar numbers are printed as three space-separated groups of 4 digits, all
 * on one line. The separator is deliberately a literal space (not `\s`) —
 * `\s` also matches newlines, which let this bridge across line breaks (e.g.
 * the tail of a "DOB: 01/01/1990" line plus the start of the next line) into
 * a garbage 12-digit number instead of not matching at all.
 */
const AADHAAR_IN_TEXT = /\b(\d{4}) ?(\d{4}) ?(\d{4})\b/;

export function extractPan(text: string): string | null {
    const match = text.toUpperCase().match(PAN_IN_TEXT);
    return match?.[0] ?? null;
}

export function extractGstin(text: string): string | null {
    const match = text.toUpperCase().match(GSTIN_IN_TEXT);
    return match?.[0] ?? null;
}

export function extractAadhaar(text: string): string | null {
    const match = text.match(AADHAAR_IN_TEXT);
    if (!match) return null;
    return `${match[1]}${match[2]}${match[3]}`;
}

export type OcrDocumentType = "PAN_CARD" | "GSTIN_CERTIFICATE" | "AADHAAR";

const EXTRACTORS: Record<OcrDocumentType, (text: string) => string | null> = {
    PAN_CARD: extractPan,
    GSTIN_CERTIFICATE: extractGstin,
    AADHAAR: extractAadhaar,
};

/** Runs the extractor matching the declared document type against OCR'd text. */
export function extractByDocumentType(
    documentType: OcrDocumentType,
    text: string,
): string | null {
    return EXTRACTORS[documentType](text);
}
