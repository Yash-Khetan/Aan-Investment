import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { FormErrors } from "../../components/ui/FormErrors";
import { StepForm } from "../../components/ui/StepForm";
import { SuccessState } from "../../components/ui/States";
import { GuarantorsSection } from "../guarantors/components/GuarantorsSection";
import { useAuth } from "../auth/AuthContext";
import { useAutosaveDraft, loadDraft, clearDraft } from "../../hooks/useAutosaveDraft";
import { createLoan } from "./api";
import { loanFormSteps } from "./components/loanFormSteps";
import { EMPTY_LOAN_FORM, formStateToCreateInput } from "./types";
import type { Loan, LoanFormState } from "./types";

const DRAFT_KEY = "loan:create";

/**
 * A new loan, filled in step by step. Saving creates the loan and its
 * interest configuration together; guarantors can then be added against it.
 * Money is never entered here — disbursements and receipts go on the loan's
 * Ledger tab.
 */
export function CreateLoanPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  // Draft laid over the defaults, so one saved before a field existed still
  // yields a complete form rather than undefined values.
  const [form, setForm] = useState<LoanFormState>(() => ({
    ...EMPTY_LOAN_FORM,
    ...loadDraft<LoanFormState>(DRAFT_KEY),
  }));
  const [createdLoan, setCreatedLoan] = useState<Loan | null>(null);

  useAutosaveDraft(DRAFT_KEY, form, status === "authenticated" && !createdLoan);

  const mutation = useMutation({
    mutationFn: createLoan,
    onSuccess: (loan) => {
      clearDraft(DRAFT_KEY);
      setCreatedLoan(loan);
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["lookup"] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  function patch(p: Partial<LoanFormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  if (createdLoan) {
    return (
      <div>
        <PageHeader
          title={`Loan ${createdLoan.loanAccountNumber} created`}
          description="Add any guarantors now, or open the loan to record its first disbursement."
        />
        <div className="flex flex-col gap-6">
          <SuccessState message={`${createdLoan.loanAccountNumber} for ${createdLoan.borrowerName ?? "the borrower"} is saved.`} />
          <GuarantorsSection loanId={createdLoan.id} />
          <div className="flex gap-2">
            <Button type="button" onClick={() => navigate(`/loans/${createdLoan.id}?tab=ledger`)}>
              Open the loan's ledger
            </Button>
            <Link to={`/loans/${createdLoan.id}`}>
              <Button variant="secondary">Open the loan</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader back={{ to: "/loans", label: "All loans" }} title="New loan" />
      <StepForm
        steps={loanFormSteps(form, patch)}
        onSubmit={() => mutation.mutate(formStateToCreateInput(form))}
        submitLabel="Create loan"
        isSubmitting={mutation.isPending}
        onCancel={() => navigate("/loans")}
        footer={mutation.isError && <FormErrors error={mutation.error} />}
      />
    </div>
  );
}
