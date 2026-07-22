import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { createCollateral } from "../api";
import { SECURITY_TYPES } from "../types";

export function CreateCollateralForm({ loanId, onDone }: { loanId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [securityType, setSecurityType] = useState<string>("PROPERTY");
  const [description, setDescription] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [valuationDate, setValuationDate] = useState("");
  const [valuationBy, setValuationBy] = useState("");

  const mutation = useMutation({
    mutationFn: createCollateral,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collateral", loanId] });
      onDone();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      loanId,
      securityType,
      description: description || undefined,
      propertyAddress: propertyAddress || undefined,
      estimatedValue: Number(estimatedValue),
      valuationDate: valuationDate || undefined,
      valuationBy: valuationBy || undefined,
    });
  }

  return (
    <Card className="mb-4 p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField label="Security Type" value={securityType} onChange={(e) => setSecurityType(e.target.value)} required>
            {SECURITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Estimated Value (INR)"
            type="number"
            min="0"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            required
          />
          <TextField label="Valuation Date" type="date" value={valuationDate} onChange={(e) => setValuationDate(e.target.value)} />
          <TextField label="Valued By" value={valuationBy} onChange={(e) => setValuationBy(e.target.value)} />
          <TextField label="Property Address" value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} />
        </div>
        <TextAreaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

        {mutation.isError && (
          <div className="text-xs text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : "Failed to create collateral."}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Add Collateral"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
