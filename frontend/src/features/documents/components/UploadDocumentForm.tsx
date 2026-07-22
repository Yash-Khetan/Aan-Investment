import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField } from "../../../components/ui/Field";
import { uploadDocument } from "../api";
import { DOCUMENT_TYPES, type EntityType } from "../types";

export function UploadDocumentForm({
  entityType,
  entityId,
  onDone,
}: {
  entityType: EntityType;
  entityId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [documentType, setDocumentType] = useState<string>("OTHER");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Choose a file first.");
      return uploadDocument({ entityType, entityId, documentType, name: name || undefined, file });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", entityType, entityId] });
      onDone();
    },
  });

  return (
    <Card className="mb-4 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="flex flex-col gap-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField label="Document Type" value={documentType} onChange={(e) => setDocumentType(e.target.value)} required>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </SelectField>
          <TextField label="Display Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" />
          <div>
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
        </div>

        {mutation.isError && (
          <div className="text-xs text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : "Upload failed."}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Uploading..." : "Upload"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
