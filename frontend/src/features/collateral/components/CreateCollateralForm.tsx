import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { useAuth } from "../../auth/AuthContext";
import { useAutosaveDraft, loadDraft, clearDraft } from "../../../hooks/useAutosaveDraft";
import { createCollateral } from "../api";
import { SECURITY_TYPE_ORDER } from "../types";

interface CollateralDraft {
  securityType: string;
  otherSecurityType: string;
  description: string;
  propertyAddress: string;
  estimatedValue: string;
  valuationDate: string;
  valuationBy: string;
}

const EMPTY_DRAFT: CollateralDraft = {
  securityType: "PROPERTY",
  otherSecurityType: "",
  description: "",
  propertyAddress: "",
  estimatedValue: "",
  valuationDate: "",
  valuationBy: "",
};

export function CreateCollateralForm({ loanId, onDone }: { loanId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const draftKey = `collateral:create:${loanId}`;

  const [draft, setDraft] = useState<CollateralDraft>(() => loadDraft<CollateralDraft>(draftKey) ?? EMPTY_DRAFT);
  const { securityType, otherSecurityType, description, propertyAddress, estimatedValue, valuationDate, valuationBy } = draft;

  function patch(p: Partial<CollateralDraft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  useAutosaveDraft(draftKey, draft, status === "authenticated");

  const mutation = useMutation({
    mutationFn: createCollateral,
    onSuccess: () => {
      clearDraft(draftKey);
      queryClient.invalidateQueries({ queryKey: ["collateral", loanId] });
      onDone();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      loanId,
      securityType,
      otherSecurityType: securityType === "OTHERS" ? otherSecurityType || undefined : undefined,
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
          <SelectField
            label="Security Type"
            value={securityType}
            onChange={(e) => patch({ securityType: e.target.value, otherSecurityType: "" })}
            required
          >
            {SECURITY_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </SelectField>
          {securityType === "OTHERS" && (
            <TextField
              label="Specify Security Type"
              value={otherSecurityType}
              onChange={(e) => patch({ otherSecurityType: e.target.value })}
              required
            />
          )}
          <TextField
            label="Estimated Value (INR)"
            type="number"
            min="0"
            value={estimatedValue}
            onChange={(e) => patch({ estimatedValue: e.target.value })}
            required
          />
          <TextField label="Valuation Date" type="date" value={valuationDate} onChange={(e) => patch({ valuationDate: e.target.value })} />
          <TextField label="Valued By" value={valuationBy} onChange={(e) => patch({ valuationBy: e.target.value })} />
          <TextField label="Property Address" value={propertyAddress} onChange={(e) => patch({ propertyAddress: e.target.value })} />
        </div>
        <TextAreaField label="Description" value={description} onChange={(e) => patch({ description: e.target.value })} />

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
