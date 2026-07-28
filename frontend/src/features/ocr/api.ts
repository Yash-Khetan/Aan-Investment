import { API_BASE_URL, ApiError, getAccessToken } from "../../lib/api";

export type OcrDocumentType = "PAN_CARD" | "GSTIN_CERTIFICATE" | "AADHAAR";

interface Envelope<T> {
  success: true;
  data: T;
}

/**
 * Best-effort OCR extraction. Only image files are supported (jpg/png/webp) —
 * PDFs aren't read. Returns `extractedValue: null` when nothing matching the
 * document type's shape was found in the image, which is expected/common, not
 * an error condition — callers should treat it as "couldn't auto-fill" and let
 * the user type the value in manually.
 */
export async function extractDocumentData(
  file: File,
  documentType: OcrDocumentType,
): Promise<{ extractedValue: string | null }> {
  const formData = new FormData();
  formData.append("documentType", documentType);
  formData.append("file", file);

  const accessToken = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/ocr/extract`, {
    method: "POST",
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body?.error?.message ?? body?.message ?? res.statusText, res.status);
  }

  const body = (await res.json()) as Envelope<{ extractedValue: string | null }>;
  return body.data;
}
