import { apiRequest, downloadFile, getAccessToken, API_BASE_URL, ApiError } from "../../lib/api";
import type { DocumentMetadata, DocumentSource } from "./types";

/** Pass `source` to get only identity-field uploads, or only Documents-page uploads. */
export function listDocuments(
  entityType: string,
  entityId: string,
  source?: DocumentSource,
): Promise<DocumentMetadata[]> {
  const query = source ? `?source=${source}` : "";
  return apiRequest<DocumentMetadata[]>(`/documents/entity/${entityType}/${entityId}${query}`);
}

export async function uploadDocument(input: {
  entityType: string;
  entityId: string;
  documentType: string;
  /** Omitted means GENERAL - the backend's default for the Documents page. */
  source?: DocumentSource;
  name?: string;
  remarks?: string;
  file: File;
}): Promise<DocumentMetadata> {
  const formData = new FormData();
  formData.append("entityType", input.entityType);
  formData.append("entityId", input.entityId);
  formData.append("documentType", input.documentType);
  if (input.source) formData.append("source", input.source);
  if (input.name) formData.append("name", input.name);
  if (input.remarks) formData.append("remarks", input.remarks);
  formData.append("file", input.file);

  const accessToken = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: "POST",
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body?.message ?? body?.error?.message ?? res.statusText, res.status);
  }

  return (await res.json()) as DocumentMetadata;
}

export function downloadDocument(id: string, name: string): Promise<void> {
  return downloadFile(`/documents/${id}`, name);
}

export function deleteDocument(id: string): Promise<void> {
  return apiRequest<void>(`/documents/${id}`, { method: "DELETE" });
}

export interface SignedUrlResult {
  url: string;
  /** ISO timestamp — the backend sends a Date, which JSON-serializes to a string. */
  expiresAt: string;
}

/** Fetches a time-limited URL for a stored document. Defaults to the backend's 5-minute expiry. */
export function getDocumentSignedUrl(id: string, expiresInSeconds?: number): Promise<SignedUrlResult> {
  const query = expiresInSeconds ? `?expiresIn=${expiresInSeconds}` : "";
  return apiRequest<SignedUrlResult>(`/documents/${id}/signed-url${query}`);
}

/**
 * Opens a document in a new tab. The blank tab is opened synchronously, before
 * the await — a `window.open` issued after an await has lost the click's
 * user-gesture context and is blocked by Safari and Firefox.
 *
 * `noopener` is deliberately NOT passed to `window.open`: with it the call
 * returns null and there would be no handle to navigate. The opener reference
 * is severed manually instead, while the blank tab is still same-origin, so
 * the Supabase URL we send it to cannot reach back into this window.
 */
export async function viewDocument(id: string): Promise<void> {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;

  try {
    const { url } = await getDocumentSignedUrl(id);
    if (tab) tab.location.href = url;
    // Popup blocked outright — fall back to navigating this tab rather than
    // silently doing nothing.
    else window.location.href = url;
  } catch (error) {
    tab?.close();
    throw error;
  }
}
