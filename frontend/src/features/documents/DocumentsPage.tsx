import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { SelectField } from "../../components/ui/Field";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { LoanSelect } from "../lookup/LoanSelect";
import { BorrowerSelect } from "../lookup/BorrowerSelect";
import { listDocuments } from "./api";
import { UploadDocumentForm } from "./components/UploadDocumentForm";
import { DocumentCard } from "./components/DocumentCard";
import { ENTITY_TYPES, type EntityType } from "./types";

export function DocumentsPage() {
  const [entityType, setEntityType] = useState<EntityType>("LOAN");
  const [entityId, setEntityId] = useState("");
  const [showForm, setShowForm] = useState(false);

  function handleEntityTypeChange(next: EntityType) {
    setEntityType(next);
    setEntityId("");
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["documents", entityType, entityId],
    queryFn: () => listDocuments(entityType, entityId),
    enabled: entityId !== "",
  });

  return (
    <div>
      <PageHeader title="Documents" description="Upload, list, download, and delete files against a loan or borrower." />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="w-full sm:w-48">
          <SelectField label="Entity Type" value={entityType} onChange={(e) => handleEntityTypeChange(e.target.value as EntityType)}>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-full sm:w-96">
          {entityType === "LOAN" ? (
            <LoanSelect label="Loan" value={entityId} onChange={setEntityId} />
          ) : (
            <BorrowerSelect label="Borrower" value={entityId} onChange={setEntityId} />
          )}
        </div>
        {entityId && <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ Upload"}</Button>}
      </div>

      {!entityId && <EmptyState message="Select a loan or borrower to view its documents." />}

      {entityId && showForm && (
        <UploadDocumentForm entityType={entityType} entityId={entityId} onDone={() => setShowForm(false)} />
      )}

      {entityId && isLoading && <LoadingState label="Loading documents..." />}
      {entityId && isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load documents."} />}
      {entityId && data && data.length === 0 && <EmptyState message="No documents uploaded yet." />}

      <div className="flex flex-col gap-3">
        {data?.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} entityType={entityType} entityId={entityId} />
        ))}
      </div>
    </div>
  );
}
