import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LoadingState, ErrorState } from "../../components/ui/States";
import { FormErrors } from "../../components/ui/FormErrors";
import { BorrowerMasterFields } from "./components/BorrowerMasterFields";
import { RelatedPersonsEditor } from "./components/RelatedPersonsEditor";
import { getBorrower, updateBorrower } from "./api";
import { listDocuments } from "../documents/api";
import { UploadDocumentForm } from "../documents/components/UploadDocumentForm";
import { DocumentCard } from "../documents/components/DocumentCard";
import { useAuth } from "../auth/AuthContext";
import { useAutosaveDraft, loadDraft, clearDraft } from "../../hooks/useAutosaveDraft";
import { EMPTY_BORROWER_FORM, borrowerToFormState, formStateToUpdateInput } from "./types";
import type { BorrowerFormState } from "./types";

export function EditBorrowerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const draftKey = `borrower:edit:${id}`;

  const [form, setForm] = useState<BorrowerFormState>(EMPTY_BORROWER_FORM);
  const [loaded, setLoaded] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["borrower", id],
    queryFn: () => getBorrower(id!),
    enabled: !!id,
  });

  const { data: documents } = useQuery({
    queryKey: ["documents", "BORROWER", id],
    queryFn: () => listDocuments("BORROWER", id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (data && !loaded) {
      // A locally autosaved draft reflects unsaved edits in progress — it takes
      // precedence over the persisted record until the user explicitly saves.
      setForm(loadDraft<BorrowerFormState>(draftKey) ?? borrowerToFormState(data));
      setLoaded(true);
    }
  }, [data, loaded, draftKey]);

  useAutosaveDraft(draftKey, form, status === "authenticated" && loaded);

  const mutation = useMutation({
    mutationFn: () => updateBorrower(id!, formStateToUpdateInput(form)),
    onSuccess: () => {
      clearDraft(draftKey);
      queryClient.invalidateQueries({ queryKey: ["borrowers"] });
      queryClient.invalidateQueries({ queryKey: ["borrower", id] });
      navigate("/borrowers");
    },
  });

  function patch(p: Partial<BorrowerFormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <div>
      <PageHeader title="Edit Borrower" description="Update borrower master data." />

      {isLoading && <LoadingState label="Loading borrower..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load borrower."} />}

      {data && loaded && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <BorrowerMasterFields form={form} onChange={patch} showStatus />

          {mutation.isError && <FormErrors error={mutation.error} />}

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/borrowers")}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Related persons save individually against their own endpoints, so this
          sits outside the borrower form rather than inside its submit. It is a
          commercial-sheet block, so consumers never see it. */}
      {id && data && loaded && form.borrowerType === "COMMERCIAL" && (
        <div className="mt-6">
          <RelatedPersonsEditor borrowerId={id} />
        </div>
      )}

      {id && (
        <Card className="mt-6 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Documents</h2>
            <Button type="button" variant="secondary" onClick={() => setShowUploadForm((s) => !s)}>
              {showUploadForm ? "Cancel" : "+ Upload"}
            </Button>
          </div>

          {showUploadForm && (
            <UploadDocumentForm entityType="BORROWER" entityId={id} onDone={() => setShowUploadForm(false)} />
          )}

          {documents && documents.length === 0 && <p className="text-sm text-slate-400">No documents uploaded yet.</p>}
          <div className="flex flex-col gap-3">
            {documents?.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} entityType="BORROWER" entityId={id} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
