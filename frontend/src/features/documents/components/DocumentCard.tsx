import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatDate } from "../../../lib/format";
import { deleteDocument, downloadDocument } from "../api";
import type { DocumentMetadata, EntityType } from "../types";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentCard({
  doc,
  entityType,
  entityId,
}: {
  doc: DocumentMetadata;
  entityType: EntityType;
  entityId: string;
}) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(doc.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", entityType, entityId] }),
  });

  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">{doc.name}</span>
          <Badge status={doc.documentType} />
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {formatBytes(doc.sizeBytes)} · {doc.mimeType} · uploaded {formatDate(doc.createdAt)}
        </div>
        {doc.remarks && <div className="mt-1 text-xs text-slate-400">{doc.remarks}</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => downloadDocument(doc.id, doc.fileName ?? doc.name)}>
          Download
        </Button>
        <Button variant="danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
          Delete
        </Button>
      </div>
    </Card>
  );
}
