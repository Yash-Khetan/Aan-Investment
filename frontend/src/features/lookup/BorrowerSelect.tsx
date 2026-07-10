import { SelectField } from "../../components/ui/Field";
import { useBorrowerLookup } from "./hooks";

export function BorrowerSelect({
  label = "Borrower",
  value,
  onChange,
  required,
}: {
  label?: string;
  value: string;
  onChange: (borrowerId: string) => void;
  required?: boolean;
}) {
  const { data, isLoading } = useBorrowerLookup();

  return (
    <SelectField label={label} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{isLoading ? "Loading borrowers..." : "Select a borrower"}</option>
      {data?.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name} ({b.borrowerCode})
        </option>
      ))}
    </SelectField>
  );
}
