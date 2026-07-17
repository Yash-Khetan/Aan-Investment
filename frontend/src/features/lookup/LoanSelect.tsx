import { SelectField } from "../../components/ui/Field";
import { useLoanLookup } from "./hooks";

export function LoanSelect({
  label = "Loan",
  value,
  onChange,
  required,
}: {
  label?: string;
  value: string;
  onChange: (loanId: string) => void;
  required?: boolean;
}) {
  const { data, isLoading } = useLoanLookup();

  return (
    <SelectField label={label} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{isLoading ? "Loading loans..." : "Select a loan"}</option>
      {data?.map((loan) => (
        <option key={loan.id} value={loan.id}>
          {loan.loanAccountNumber} — {loan.customerName} ({loan.status})
        </option>
      ))}
    </SelectField>
  );
}
