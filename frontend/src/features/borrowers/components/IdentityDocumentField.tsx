import { useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteIdentityDocument,
  downloadIdentityDocument,
  uploadIdentityDocument,
  viewIdentityDocument,
  type IdentityDocumentKind,
} from "../identityDocumentApi";
import { OCR_DOCUMENT_TYPE_FOR_KIND, type StoredIdentityDocument } from "../BorrowerDocumentsContext";
import { extractDocumentData } from "../../ocr/api";

/** Extensions offered in the picker. The backend enforces the real allowlist and a 10 MB cap. */
const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.webp";

/**
 * Formats OCR can read. Tesseract reads pixels, so a PDF has nothing for it to
 * look at - those upload normally but are never sent for auto-read.
 */
const OCR_READABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type OcrStatus = "idle" | "reading" | "done" | "empty" | "skipped" | "failed";

/**
 * Compact upload control nested inside an `IdentityFieldGroup` (so it renders
 * no label of its own - the group's heading already says which document this is).
 *
 * Create mode (no `borrowerId`): the file is held in memory and uploaded by the
 * caller once the borrower exists. Edit mode (`borrowerId` set): the file
 * uploads immediately, and any stored scan is shown for view, download or removal.
 *
 * Picking an image also sends a copy for OCR, reported upward via `onOcrResult`
 * so the group can offer it as a suggestion. That runs alongside the upload and
 * never gates it: OCR failing has no effect on whether the file is stored.
 *
 * Uploading is always optional - this control never renders a required input.
 */
export function IdentityDocumentField({
  kind,
  borrowerId,
  storedDoc,
  pendingFile,
  onPendingFileChange,
  onOcrResult,
}: {
  kind: IdentityDocumentKind;
  borrowerId?: string;
  storedDoc?: StoredIdentityDocument;
  pendingFile?: File | null;
  onPendingFileChange?: (file: File | null) => void;
  onOcrResult?: (status: OcrStatus, value: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [viewError, setViewError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadIdentityDocument(borrowerId!, kind, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["borrower", borrowerId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteIdentityDocument(borrowerId!, kind),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["borrower", borrowerId] }),
  });

  /** Best-effort. Every outcome is reported so the group can say what happened. */
  function runOcr(file: File) {
    if (!onOcrResult) return;

    if (!OCR_READABLE_TYPES.has(file.type)) {
      onOcrResult("skipped", null);
      return;
    }

    onOcrResult("reading", null);
    extractDocumentData(file, OCR_DOCUMENT_TYPE_FOR_KIND[kind])
      .then(({ extractedValue }) =>
        onOcrResult(extractedValue ? "done" : "empty", extractedValue),
      )
      .catch(() => onOcrResult("failed", null));
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    // Reset so re-picking the same filename still fires a change event.
    e.target.value = "";
    if (!file) return;

    if (borrowerId) uploadMutation.mutate(file);
    else onPendingFileChange?.(file);

    runOcr(file);
  }

  function clearFile() {
    onOcrResult?.("idle", null);
    if (borrowerId) deleteMutation.mutate();
    else onPendingFileChange?.(null);
  }

  function handleView() {
    setViewError(null);

    if (borrowerId && storedDoc) {
      viewIdentityDocument(borrowerId, kind).catch((error) =>
        setViewError(error instanceof Error ? error.message : "Couldn't open this document."),
      );
      return;
    }

    // Not uploaded yet - preview the file straight out of browser memory. No
    // await here, so the click's user-gesture context is intact and the popup
    // blocker stays quiet.
    if (!pendingFile) return;
    const objectUrl = URL.createObjectURL(pendingFile);
    const tab = window.open(objectUrl, "_blank");
    if (!tab) {
      URL.revokeObjectURL(objectUrl);
      setViewError("Allow pop-ups for this site to preview the file.");
      return;
    }
    // Revoking immediately would race the new tab's own load of the blob.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  const displayName = borrowerId ? storedDoc?.name ?? storedDoc?.path : pendingFile?.name;
  const hasFile = borrowerId ? Boolean(storedDoc) : Boolean(pendingFile);

  return (
    <div>
      {hasFile ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-emerald-50 px-2.5 py-1.5 text-sm">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-emerald-600">&#10003;</span>
            <span className="truncate text-slate-700">{displayName}</span>
          </span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="text-xs text-slate-500 underline" onClick={handleView}>
              View
            </button>
            {borrowerId && storedDoc && (
              <button
                type="button"
                className="text-xs text-slate-500 underline"
                onClick={() => downloadIdentityDocument(borrowerId, kind, storedDoc.name ?? `${kind}-document`)}
              >
                Download
              </button>
            )}
            <button
              type="button"
              className="text-xs text-red-600 underline"
              onClick={clearFile}
              disabled={deleteMutation.isPending}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <input
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileChange}
          disabled={uploadMutation.isPending}
          className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-900 file:px-2.5 file:py-1 file:text-xs file:text-white"
        />
      )}

      {uploadMutation.isPending && <p className="mt-1 text-xs text-slate-400">Uploading&hellip;</p>}
      {uploadMutation.isError && (
        <p className="mt-1 text-xs text-red-600">
          {uploadMutation.error instanceof Error ? uploadMutation.error.message : "Upload failed."}
        </p>
      )}
      {deleteMutation.isError && (
        <p className="mt-1 text-xs text-red-600">
          {deleteMutation.error instanceof Error ? deleteMutation.error.message : "Couldn't remove this document."}
        </p>
      )}
      {viewError && <p className="mt-1 text-xs text-red-600">{viewError}</p>}
    </div>
  );
}
