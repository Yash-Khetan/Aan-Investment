import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { FormErrors } from "../../components/ui/FormErrors";
import { LoanMasterFields } from "./components/LoanMasterFields";
import { createLoan } from "./api";
import { EMPTY_LOAN_FORM, formStateToCreateInput } from "./types";
import type { LoanFormState } from "./types";

export function CreateLoanPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<LoanFormState>(EMPTY_LOAN_FORM);

  const mutation = useMutation({
    mutationFn: createLoan,
    onSuccess: () => navigate("/loans"),
  });

  function patch(p: Partial<LoanFormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(formStateToCreateInput(form));
  }

  return (
    <div>
      <PageHeader title="New Loan" description="Loan master — sanction terms, tenure, and key dates." />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <LoanMasterFields form={form} onChange={patch} />

        {mutation.isError && <FormErrors error={mutation.error} />}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Create Loan"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/loans")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
