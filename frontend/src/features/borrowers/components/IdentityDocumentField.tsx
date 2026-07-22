import { useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteDocument, downloadDocument, uploadDocument } from "../../documents/api";
import { extractDocumentData, type OcrDocumentType } from "../../ocr/api";
import type { DocumentMetadata } from "../../documents/types";

/** Image types OCR can actually read — Tesseract reads pixels, not a PDF's text layer. */
const OCR_ELIGIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Compact upload control nested inside an `IdentityFieldGroup` (so it renders
 * no label of its own — the group's heading already says which document this
 * is). Create mode (no borrowerId): file is held in memory and uploaded by the
 * caller once the borrower exists. Edit mode (borrowerId set): file uploads
 * immediately, and any existing doc is shown for download/removal.
 * On file select, best-effort OCR runs in the background and — if it finds a
 * matching value — calls onExtracted so the caller can pre-fill the paired
 * text field. The user can still edit/override whatever gets suggested.
 */
export function IdentityDocumentField({
  documentType,
  label,
  borrowerId,
  existingDoc,
  pendingFile,
  onPendingFileChange,
  onExtracted,
  required,
}: {
  documentType: OcrDocumentType;
  /** Used only as the display name stored with the uploaded document, never rendered here. */
  label: string;
  borrowerId?: string;
  existingDoc?: DocumentMetadata;
  pendingFile?: File | null;
  onPendingFileChange?: (file: File | null) => void;
  onExtracted?: (value: string) => void;
  required?: boolean;
}) {
  const queryClient = useQueryClient();
  const [ocrStatus, setOcrStatus] = useState<"idle" | "reading" | "done" | "failed">("idle");

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadDocument({ entityType: "BORROWER", entityId: borrowerId!, documentType, name: label, file }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", "BORROWER", borrowerId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(existingDoc!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", "BORROWER", borrowerId] }),
  });

  function runOcr(file: File) {
    if (!OCR_ELIGIBLE_TYPES.has(file.type)) return; // PDFs etc. — silently skipped, no auto-fill
    setOcrStatus("reading");
    extractDocumentData(file, documentType)
      .then(({ extractedValue }) => {
        setOcrStatus("done");
        if (extractedValue) onExtracted?.(extractedValue);
      })
      .catch(() => setOcrStatus("failed"));
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    if (borrowerId) {
      uploadMutation.mutate(file);
    } else {
      onPendingFileChange?.(file);
    }
    runOcr(file);
  }

  const uploadedFileName = borrowerId ? existingDoc?.fileName ?? existingDoc?.name : pendingFile?.name;
  const hasFile = borrowerId ? Boolean(existingDoc) : Boolean(pendingFile);

  return (
    <div>
      {hasFile ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-emerald-50 px-2.5 py-1.5 text-sm">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-emerald-600">✓</span>
            <span className="truncate text-slate-700">{uploadedFileName}</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {borrowerId && existingDoc && (
              <button
                type="button"
                className="text-xs text-slate-500 underline"
                onClick={() => downloadDocument(existingDoc.id, existingDoc.fileName ?? existingDoc.name)}
              >
                Download
              </button>
            )}
            <button
              type="button"
              className="text-xs text-red-600 underline"
              onClick={() => (borrowerId ? deleteMutation.mutate() : onPendingFileChange?.(null))}
              disabled={deleteMutation.isPending}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleFileChange}
          disabled={uploadMutation.isPending}
          required={required}
          className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-900 file:px-2.5 file:py-1 file:text-xs file:text-white"
        />
      )}

      {ocrStatus === "reading" && <p className="mt-1 text-xs text-slate-400">Reading document…</p>}
      {ocrStatus === "failed" && (
        <p className="mt-1 text-xs text-slate-400">Couldn't auto-read this file — enter the value manually.</p>
      )}
      {uploadMutation.isError && (
        <p className="mt-1 text-xs text-red-600">
          {uploadMutation.error instanceof Error ? uploadMutation.error.message : "Upload failed."}
        </p>
      )}
    </div>
  );
}
