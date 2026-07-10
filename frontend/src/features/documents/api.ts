import { apiRequest, downloadFile, API_BASE_URL, ApiError } from "../../lib/api";
import type { DocumentMetadata } from "./types";

export function listDocuments(entityType: string, entityId: string): Promise<DocumentMetadata[]> {
  return apiRequest<DocumentMetadata[]>(`/documents/entity/${entityType}/${entityId}`);
}

export async function uploadDocument(input: {
  entityType: string;
  entityId: string;
  documentType: string;
  name?: string;
  remarks?: string;
  file: File;
}): Promise<DocumentMetadata> {
  const formData = new FormData();
  formData.append("entityType", input.entityType);
  formData.append("entityId", input.entityId);
  formData.append("documentType", input.documentType);
  if (input.name) formData.append("name", input.name);
  if (input.remarks) formData.append("remarks", input.remarks);
  formData.append("file", input.file);

  const res = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: "POST",
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
