import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SelectField, TextField } from "../../components/ui/Field";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatDate } from "../../lib/format";
import { LoanSelect } from "../lookup/LoanSelect";
import { BorrowerSelect } from "../lookup/BorrowerSelect";
import { deleteDocument, downloadDocument, searchDocuments, viewDocument } from "./api";
import { UploadDocumentForm } from "./components/UploadDocumentForm";
import { ALL_DOCUMENT_TYPES, ENTITY_TYPES, type DocumentSearchRow, type EntityType } from "./types";

const PAGE_SIZE = 25;

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const typeLabel = (t: string) => t.replace(/_/g, " ");

/**
 * Every document in the system in one list — loan documents, borrower
 * documents and identity scans alike — newest first, narrowed by borrower,
 * loan, type or a search. Picking a borrower also brings in the documents of
 * every loan they hold.
 */
export function DocumentsPage() {
  const [borrowerId, setBorrowerId] = useState("");
  const [loanId, setLoanId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);

  const filters = { borrowerId, loanId, documentType, search: search.trim(), page, limit: PAGE_SIZE };
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["documents", "search", filters],
    queryFn: () => searchDocuments(filters),
    placeholderData: keepPreviousData,
  });

  // Any filter change starts again from the first page.
  function filter<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(1);
    };
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const hasFilters = borrowerId || loanId || documentType || search;

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Every document of every borrower and loan, including identity scans and collateral documents."
      />

      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowUpload((s) => !s)}>{showUpload ? "Close upload" : "+ Upload document"}</Button>
      </div>

      {showUpload && <UploadPanel onDone={() => setShowUpload(false)} />}

      <Card className="mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <BorrowerSelect label="Borrower" placeholder="All borrowers" value={borrowerId} onChange={filter(setBorrowerId)} />
        <LoanSelect label="Loan" placeholder="All loans" value={loanId} onChange={filter(setLoanId)} />
        <SelectField label="Document type" value={documentType} onChange={(e) => filter(setDocumentType)(e.target.value)}>
          <option value="">All types</option>
          {ALL_DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Search"
          placeholder="Name, borrower or loan number"
          value={search}
          onChange={(e) => filter(setSearch)(e.target.value)}
        />
      </Card>

      {isLoading && <LoadingState label="Loading documents..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load documents."} />}
      {data && data.rows.length === 0 && (
        <EmptyState message={hasFilters ? "No documents match these filters." : "No documents uploaded yet."} />
      )}

      {data && data.rows.length > 0 && (
        <>
          <Card className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Document", "Type", "Borrower", "Loan", "Uploaded", "Size", ""].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.rows.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} />
                ))}
              </tbody>
            </table>
          </Card>

          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <span>
              {data.total} document{data.total === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-2">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              Page {page} of {totalPages}
              <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function DocumentRow({ doc }: { doc: DocumentSearchRow }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteDocument(doc.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["borrower"] });
    },
  });

  return (
    <tr>
      <td className="max-w-xs px-4 py-2.5">
        <div className="truncate font-medium text-slate-900" title={doc.name}>
          {doc.name}
        </div>
        {doc.remarks && <div className="truncate text-xs text-slate-400">{doc.remarks}</div>}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{typeLabel(doc.documentType)}</td>
      <td className="px-4 py-2.5 text-slate-700">{doc.borrowerName ?? "—"}</td>
      <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{doc.loanAccountNumber ?? "—"}</td>
      <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{formatDate(doc.createdAt)}</td>
      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{formatBytes(doc.sizeBytes)}</td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right">
        <span className="inline-flex gap-3 text-xs">
          <button type="button" className="text-slate-600 underline" onClick={() => void viewDocument(doc.id)}>
            View
          </button>
          <button
            type="button"
            className="text-slate-600 underline"
            onClick={() => void downloadDocument(doc.id, doc.fileName ?? doc.name)}
          >
            Download
          </button>
          <button
            type="button"
            className="text-red-600 underline disabled:opacity-50"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(`Delete "${doc.name}"?`)) remove.mutate();
            }}
          >
            Delete
          </button>
        </span>
      </td>
    </tr>
  );
}

/** Upload a document against one loan or one borrower. */
function UploadPanel({ onDone }: { onDone: () => void }) {
  const [entityType, setEntityType] = useState<EntityType>("LOAN");
  const [entityId, setEntityId] = useState("");

  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          label="Attach to"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value as EntityType);
            setEntityId("");
          }}
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === "LOAN" ? "A loan" : "A borrower"}
            </option>
          ))}
        </SelectField>
        {entityType === "LOAN" ? (
          <LoanSelect label="Loan" value={entityId} onChange={setEntityId} />
        ) : (
          <BorrowerSelect label="Borrower" value={entityId} onChange={setEntityId} />
        )}
      </div>
      {entityId ? (
        <UploadDocumentForm entityType={entityType} entityId={entityId} onDone={onDone} />
      ) : (
        <p className="text-sm text-slate-500">Choose the {entityType === "LOAN" ? "loan" : "borrower"} first.</p>
      )}
    </Card>
  );
}
