import { SelectField } from "../../components/ui/Field";
import { useBorrowerLookup } from "./hooks";

export function BorrowerSelect({
  label = "Borrower",
  value,
  onChange,
  required,
  placeholder = "Select a borrower",
}: {
  label?: string;
  /** Text of the empty option — e.g. "All borrowers" when the select is a filter. */
  placeholder?: string;
  value: string;
  onChange: (borrowerId: string) => void;
  required?: boolean;
}) {
  const { data, isLoading } = useBorrowerLookup();

  return (
    <SelectField label={label} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{isLoading ? "Loading borrowers..." : placeholder}</option>
      {data?.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name} ({b.borrowerCode})
        </option>
      ))}
    </SelectField>
  );
}
