import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui/States";
import { searchDocuments } from "../../documents/api";
import { DocumentCard } from "../../documents/components/DocumentCard";
import { UploadDocumentForm } from "../../documents/components/UploadDocumentForm";

/** The loan's documents, collateral documents included, and uploading more. */
export function LoanDocumentsTab({ loanId }: { loanId: string }) {
  const [showUpload, setShowUpload] = useState(false);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["documents", "search", { loanId }],
    queryFn: () => searchDocuments({ loanId, limit: 100 }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => setShowUpload((s) => !s)}>{showUpload ? "Cancel" : "Upload document"}</Button>
      </div>
      {showUpload && <UploadDocumentForm entityType="LOAN" entityId={loanId} onDone={() => setShowUpload(false)} />}
      {isLoading && <LoadingState label="Loading documents..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Could not load documents."} />}
      {data && data.rows.length === 0 && <EmptyState message="No documents for this loan yet." />}
      <div className="flex flex-col gap-3">
        {data?.rows.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} />
        ))}
      </div>
    </div>
  );
}
