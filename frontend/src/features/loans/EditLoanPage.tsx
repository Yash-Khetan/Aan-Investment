import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { LoadingState, ErrorState } from "../../components/ui/States";
import { FormErrors } from "../../components/ui/FormErrors";
import { StepForm } from "../../components/ui/StepForm";
import { loanFormSteps } from "./components/loanFormSteps";
import { useAuth } from "../auth/AuthContext";
import { useAutosaveDraft, loadDraft, clearDraft } from "../../hooks/useAutosaveDraft";
import { getLoan, updateLoan } from "./api";
import { EMPTY_LOAN_FORM, loanToFormState, formStateToUpdateInput } from "./types";
import type { LoanFormState } from "./types";

export function EditLoanPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const draftKey = `loan:edit:${id}`;

  const [form, setForm] = useState<LoanFormState>(EMPTY_LOAN_FORM);
  const [loaded, setLoaded] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["loan", id],
    queryFn: () => getLoan(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (data && !loaded) {
      // A locally autosaved draft reflects unsaved edits in progress — it takes
      // precedence over the persisted record until the user explicitly saves.
      // Laid OVER the persisted record rather than replacing it, so a draft
      // saved before a field existed doesn't submit that field as undefined
      // and quietly overwrite what's stored.
      const draft = loadDraft<LoanFormState>(draftKey);
      const persisted = loanToFormState(data);
      setForm(draft ? { ...persisted, ...draft } : persisted);
      setLoaded(true);
    }
  }, [data, loaded, draftKey]);

  useAutosaveDraft(draftKey, form, status === "authenticated" && loaded);

  const mutation = useMutation({
    mutationFn: () => updateLoan(id!, formStateToUpdateInput(form)),
    onSuccess: () => {
      clearDraft(draftKey);
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan", id] });
      // Saving here can write a new interest configuration, which the Ledger
      // accrues at — drop its cached copies so it isn't served pre-edit.
      queryClient.invalidateQueries({ queryKey: ["ledger", id] });
      queryClient.invalidateQueries({ queryKey: ["ledger-dpd", id] });
      navigate(`/loans/${id}`);
    },
  });

  function patch(p: Partial<LoanFormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  return (
    <div>
      <PageHeader
        back={id ? { to: `/loans/${id}`, label: data ? `Back to ${data.loanAccountNumber}` : "Back to loan" } : undefined}
        title={data ? `Edit ${data.loanAccountNumber}` : "Edit loan"}
        description="Open any step to change it, then save."
      />

      {isLoading && <LoadingState label="Loading loan..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Could not load the loan."} />}

      {data && loaded && (
        <StepForm
          steps={loanFormSteps(form, patch, data.borrowerName ?? data.borrowerId)}
          onSubmit={() => mutation.mutate()}
          submitLabel="Save changes"
          isSubmitting={mutation.isPending}
          onCancel={() => navigate(`/loans/${id}`)}
          freeNavigation
          footer={mutation.isError && <FormErrors error={mutation.error} />}
        />
      )}
    </div>
  );
}
