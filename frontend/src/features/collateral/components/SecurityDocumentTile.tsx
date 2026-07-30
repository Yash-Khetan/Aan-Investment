import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { formatDate } from "../../../lib/format";
import { listDocuments, uploadDocument, downloadDocument, deleteDocument } from "../../documents/api";

/** Per-security document upload tile: lists and uploads loan documents scoped to one fixed document type. */
export function SecurityDocumentTile({
  loanId,
  documentType,
  title,
}: {
  loanId: string;
  documentType: string;
  title: string;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const { data } = useQuery({
    queryKey: ["documents", "LOAN", loanId],
    queryFn: () => listDocuments("LOAN", loanId),
  });

  const docs = data?.filter((d) => d.documentType === documentType) ?? [];

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Choose a file first.");
      return uploadDocument({ entityType: "LOAN", entityId: loanId, documentType, file });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", "LOAN", loanId] });
      setFile(null);
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", "LOAN", loanId] }),
  });

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">{title} Documents</span>
        <Button variant="secondary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Upload"}
        </Button>
      </div>

      {docs.length === 0 && !showForm && <div className="text-xs text-slate-400">No documents uploaded yet.</div>}

      <div className="flex flex-col gap-2">
        {docs.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-sm">
            <div>
              <span className="text-slate-700">{doc.name}</span>
              <span className="ml-2 text-xs text-slate-400">uploaded {formatDate(doc.createdAt)}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs text-slate-500 underline"
                onClick={() => downloadDocument(doc.id, doc.fileName ?? doc.name)}
              >
                Download
              </button>
              <button
                type="button"
                className="text-xs text-red-600 underline"
                onClick={() => deleteMutation.mutate(doc.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <form
          className="mt-3 flex items-end gap-3 border-t border-slate-100 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            uploadMutation.mutate();
          }}
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              File <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:text-white"
              required
            />
          </div>
          <Button type="submit" disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? "Uploading..." : "Upload"}
          </Button>
        </form>
      )}

      {uploadMutation.isError && (
        <div className="mt-2 text-xs text-red-600">
          {uploadMutation.error instanceof Error ? uploadMutation.error.message : "Upload failed."}
        </div>
      )}
    </Card>
  );
}
