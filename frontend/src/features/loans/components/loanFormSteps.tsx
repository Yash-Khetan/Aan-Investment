import type { FormStep } from "../../../components/ui/StepForm";
import { LoanMasterFields } from "./LoanMasterFields";
import type { LoanFormState } from "../types";

/** The loan form, one step per part — shared by the create and edit pages so both walk the same steps. */
export function loanFormSteps(
  form: LoanFormState,
  onChange: (patch: Partial<LoanFormState>) => void,
  lockedBorrowerLabel?: string,
): FormStep[] {
  const part = (section: "basic" | "interest" | "dates" | "cibil" | "notes") => (
    <LoanMasterFields form={form} onChange={onChange} lockedBorrowerLabel={lockedBorrowerLabel} section={section} />
  );
  return [
    { key: "basic", title: "Loan and borrower", description: "Who the loan is for and what kind of loan it is.", content: part("basic") },
    {
      key: "interest",
      title: "Amount and interest",
      description: "The sanctioned amount and the rates the ledger charges interest and TDS at.",
      content: part("interest"),
    },
    { key: "dates", title: "Dates", description: "Sanction and maturity. Tenure is worked out from them.", content: part("dates") },
    { key: "cibil", title: "CIBIL reporting", description: "What is reported to the credit bureau.", content: part("cibil") },
    { key: "notes", title: "Purpose and notes", description: "Optional.", content: part("notes") },
  ];
}
