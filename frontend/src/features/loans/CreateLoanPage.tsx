import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { FormErrors } from "../../components/ui/FormErrors";
import { LoanMasterFields } from "./components/LoanMasterFields";
import { InterestSetup } from "../interest/InterestSetup";
import { GuarantorsSection } from "../guarantors/components/GuarantorsSection";
import { createLoan } from "./api";
import { EMPTY_LOAN_FORM, formStateToCreateInput } from "./types";
import type { Loan, LoanFormState } from "./types";

/**
 * Two-step loan creation. Interest setup and guarantors both need a persisted
 * loanId (interest-engine calls and guarantor records key off it), so the loan
 * master is saved first and both open against the new loan — no separate
 * sidebar tabs.
 */
const STEPS = ["Loan Details", "Interest Setup & Guarantors"] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-3">
          {i > 0 && <div className="h-px w-10 bg-slate-300" />}
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                i === current
                  ? "bg-slate-900 text-white"
                  : i < current
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </span>
            <span className={`text-sm font-medium ${i === current ? "text-slate-900" : "text-slate-500"}`}>
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CreateLoanPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<LoanFormState>(EMPTY_LOAN_FORM);
  const [createdLoan, setCreatedLoan] = useState<Loan | null>(null);

  const mutation = useMutation({
    mutationFn: createLoan,
    onSuccess: (loan) => setCreatedLoan(loan),
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
      <PageHeader
        title="New Loan"
        description={
          createdLoan
            ? `Loan ${createdLoan.loanAccountNumber} created — set up interest and add any guarantors.`
            : "Loan master — sanction terms, tenure, and key dates."
        }
      />

      <StepIndicator current={createdLoan ? 1 : 0} />

      {!createdLoan && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <LoanMasterFields form={form} onChange={patch} />

          {mutation.isError && <FormErrors error={mutation.error} />}

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Create Loan & Set Up Interest"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/loans")}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {createdLoan && (
        <div className="flex flex-col gap-6">
          <InterestSetup loanId={createdLoan.id} />

          <GuarantorsSection loanId={createdLoan.id} />

          <div className="flex gap-2">
            <Button type="button" onClick={() => navigate("/loans")}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
