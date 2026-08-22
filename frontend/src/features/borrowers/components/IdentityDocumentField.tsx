import { useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteDocument, downloadDocument, uploadDocument, viewDocument } from "../../documents/api";
import type { DocumentMetadata } from "../../documents/types";
import type { BorrowerDocumentType } from "../BorrowerDocumentsContext";

/** Extensions offered in the picker. The backend enforces the real allowlist and a 10 MB cap. */
const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.webp";

/**
 * Compact upload control nested inside an `IdentityFieldGroup` (so it renders
 * no label of its own — the group's heading already says which document this
 * is).
 *
 * Create mode (no `borrowerId`): the file is held in memory and uploaded by
 * the caller once the borrower exists. Edit mode (`borrowerId` set): the file
 * uploads immediately, and any existing document is shown for view, download
 * or removal.
 *
 * Uploading is always optional — this control never renders a required input.
 */
export function IdentityDocumentField({
  documentType,
  label,
  borrowerId,
  existingDoc,
  pendingFile,
  onPendingFileChange,
}: {
  documentType: BorrowerDocumentType;
  /** Stored as the uploaded document's display name. Never rendered here. */
  label: string;
  borrowerId?: string;
  existingDoc?: DocumentMetadata;
  pendingFile?: File | null;
  onPendingFileChange?: (file: File | null) => void;
}) {
  const queryClient = useQueryClient();
  const [viewError, setViewError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadDocument({ entityType: "BORROWER", entityId: borrowerId!, documentType, name: label, file }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", "BORROWER", borrowerId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(existingDoc!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", "BORROWER", borrowerId] }),
  });

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    // Reset so re-picking the same filename still fires a change event.
    e.target.value = "";
    if (!file) return;

    if (borrowerId) uploadMutation.mutate(file);
    else onPendingFileChange?.(file);
  }

  function handleView() {
    if (!existingDoc) return;
    setViewError(null);
    viewDocument(existingDoc.id).catch((error) =>
      setViewError(error instanceof Error ? error.message : "Couldn't open this document."),
    );
  }

  const uploadedFileName = borrowerId ? existingDoc?.fileName ?? existingDoc?.name : pendingFile?.name;
  const hasFile = borrowerId ? Boolean(existingDoc) : Boolean(pendingFile);

  return (
    <div>
      {hasFile ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-emerald-50 px-2.5 py-1.5 text-sm">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-emerald-600">&#10003;</span>
            <span className="truncate text-slate-700">{uploadedFileName}</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {existingDoc && (
              <>
                <button type="button" className="text-xs text-slate-500 underline" onClick={handleView}>
                  View
                </button>
                <button
                  type="button"
                  className="text-xs text-slate-500 underline"
                  onClick={() => downloadDocument(existingDoc.id, existingDoc.fileName ?? existingDoc.name)}
                >
                  Download
                </button>
              </>
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
