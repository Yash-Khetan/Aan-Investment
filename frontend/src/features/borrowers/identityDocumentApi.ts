import { API_BASE_URL, ApiError, apiRequest, downloadFile, getAccessToken } from "../../lib/api";

/**
 * Borrower identity document scans (PAN / Aadhaar / CKYC).
 *
 * These live on the borrower record itself, not in the document vault — the
 * `documents` table belongs to another module. Endpoints hang off the borrower:
 * `/api/v1/borrowers/:id/identity-documents/:kind`.
 */

export const IDENTITY_DOCUMENT_KINDS = ["pan", "aadhaar", "ckyc"] as const;
export type IdentityDocumentKind = (typeof IDENTITY_DOCUMENT_KINDS)[number];

interface Envelope<T> {
  success: true;
  data: T;
}

export interface IdentityDocumentRef {
  kind: IdentityDocumentKind;
  path: string;
  name: string | null;
}

function basePath(borrowerId: string, kind: IdentityDocumentKind): string {
  return `/api/v1/borrowers/${borrowerId}/identity-documents/${kind}`;
}

export async function uploadIdentityDocument(
  borrowerId: string,
  kind: IdentityDocumentKind,
  file: File,
): Promise<IdentityDocumentRef> {
  const formData = new FormData();
  formData.append("file", file);

  const accessToken = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${basePath(borrowerId, kind)}`, {
    method: "POST",
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body?.error?.message ?? body?.message ?? res.statusText, res.status);
  }

  const body = (await res.json()) as Envelope<IdentityDocumentRef>;
  return body.data;
}

export async function getIdentityDocumentSignedUrl(
  borrowerId: string,
  kind: IdentityDocumentKind,
): Promise<{ url: string; expiresAt: string }> {
  const body = await apiRequest<Envelope<{ url: string; expiresAt: string }>>(
    `${basePath(borrowerId, kind)}/signed-url`,
  );
  return body.data;
}

export function downloadIdentityDocument(
  borrowerId: string,
  kind: IdentityDocumentKind,
  fileName: string,
): Promise<void> {
  return downloadFile(basePath(borrowerId, kind), fileName);
}

export function deleteIdentityDocument(borrowerId: string, kind: IdentityDocumentKind): Promise<void> {
  return apiRequest<void>(basePath(borrowerId, kind), { method: "DELETE" });
}

/**
 * Opens a stored scan in a new tab. The blank tab is opened synchronously,
 * before the await — a `window.open` issued after an await has lost the click's
 * user-gesture context and is blocked by Safari and Firefox.
 *
 * `noopener` is deliberately not passed: with it `window.open` returns null and
 * there is no handle to navigate. The opener link is severed manually instead,
 * while the blank tab is still same-origin.
 */
export async function viewIdentityDocument(borrowerId: string, kind: IdentityDocumentKind): Promise<void> {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;

  try {
    const { url } = await getIdentityDocumentSignedUrl(borrowerId, kind);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (error) {
    tab?.close();
    throw error;
  }
}
