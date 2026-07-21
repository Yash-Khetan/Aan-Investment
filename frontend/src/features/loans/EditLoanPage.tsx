import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { LoadingState, ErrorState } from "../../components/ui/States";
import { FormErrors } from "../../components/ui/FormErrors";
import { LoanMasterFields } from "./components/LoanMasterFields";
import { GuarantorsSection } from "../guarantors/components/GuarantorsSection";
import { getLoan, updateLoan } from "./api";
import { EMPTY_LOAN_FORM, loanToFormState, formStateToUpdateInput } from "./types";
import type { LoanFormState } from "./types";

export function EditLoanPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<LoanFormState>(EMPTY_LOAN_FORM);
  const [loaded, setLoaded] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["loan", id],
    queryFn: () => getLoan(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (data && !loaded) {
      setForm(loanToFormState(data));
      setLoaded(true);
    }
  }, [data, loaded]);

  const mutation = useMutation({
    mutationFn: () => updateLoan(id!, formStateToUpdateInput(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan", id] });
      navigate("/loans");
    },
  });

  function patch(p: Partial<LoanFormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <div>
      <PageHeader title="Edit Loan" description="Update loan master data." />

      {isLoading && <LoadingState label="Loading loan..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load loan."} />}

      {data && loaded && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <LoanMasterFields form={form} onChange={patch} lockedBorrowerLabel={data.borrowerName ?? data.borrowerId} />

          {mutation.isError && <FormErrors error={mutation.error} />}

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/loans")}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {data && loaded && (
        <div className="mt-6">
          <GuarantorsSection loanId={data.id} />
        </div>
      )}
    </div>
  );
}
