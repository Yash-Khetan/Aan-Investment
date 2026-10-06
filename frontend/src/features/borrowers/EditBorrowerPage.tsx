import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { LoadingState, ErrorState } from "../../components/ui/States";
import { FormErrors } from "../../components/ui/FormErrors";
import { StepForm } from "../../components/ui/StepForm";
import { borrowerFormSteps } from "./components/borrowerFormSteps";
import { RelatedPersonsEditor } from "./components/RelatedPersonsEditor";
import { getBorrower, updateBorrower } from "./api";
import { BorrowerDocumentsProvider } from "./BorrowerDocumentsContext";
import { useAuth } from "../auth/AuthContext";
import { useAutosaveDraft, loadDraft, clearDraft } from "../../hooks/useAutosaveDraft";
import { EMPTY_BORROWER_FORM, borrowerToFormState, formStateToUpdateInput } from "./types";
import type { BorrowerFormState } from "./types";

/**
 * Edit a borrower, step by step — any step can be opened directly. Identity
 * scans upload as soon as they are picked. Related persons are saved one at
 * a time as they are changed, so they sit below the form rather than in it.
 */
export function EditBorrowerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const draftKey = `borrower:edit:${id}`;

  const [form, setForm] = useState<BorrowerFormState>(EMPTY_BORROWER_FORM);
  const [loaded, setLoaded] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["borrower", id],
    queryFn: () => getBorrower(id!),
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
      queryClient.invalidateQueries({ queryKey: ["lookup"] });
      navigate(`/borrowers/${id}`);
    },
  });

  function patch(p: Partial<BorrowerFormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  return (
    <div>
      <PageHeader
        back={id ? { to: `/borrowers/${id}`, label: data ? `Back to ${data.name}` : "Back to borrower" } : undefined}
        title={data ? `Edit ${data.name}` : "Edit borrower"}
        description="Open any step to change it, then save."
      />

      {isLoading && <LoadingState label="Loading borrower..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Could not load the borrower."} />}

      {data && loaded && (
        // The borrower already exists, so identity uploads fire immediately -
        // nothing is ever held pending here.
        <BorrowerDocumentsProvider borrowerId={id} borrower={data} pendingFiles={{}} setPendingFile={() => {}}>
          <StepForm
            steps={borrowerFormSteps(form, patch, { showStatus: true })}
            onSubmit={() => mutation.mutate()}
            submitLabel="Save changes"
            isSubmitting={mutation.isPending}
            onCancel={() => navigate(`/borrowers/${id}`)}
            freeNavigation
            footer={mutation.isError && <FormErrors error={mutation.error} />}
          />
        </BorrowerDocumentsProvider>
      )}

      {/* A commercial-sheet block — consumers have no related persons. */}
      {id && data && loaded && form.borrowerType === "COMMERCIAL" && (
        <div className="mt-8">
          <RelatedPersonsEditor borrowerId={id} />
        </div>
      )}
    </div>
  );
}
