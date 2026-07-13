import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { createInterestConfig } from "../api";
import { INTEREST_BASIS_OPTIONS, INTEREST_RULE_TYPES } from "../types";
import type { InterestBasis, InterestRuleType } from "../types";

export function CreateInterestConfigForm({ loanId, onDone }: { loanId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [annualRate, setAnnualRate] = useState("");
  const [interestBasis, setInterestBasis] = useState<InterestBasis>("ACTUAL_365");
  const [ruleType, setRuleType] = useState<InterestRuleType>("NORMAL");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [customFormula, setCustomFormula] = useState("");
  const [remarks, setRemarks] = useState("");

  const mutation = useMutation({
    mutationFn: createInterestConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interest-config", loanId] });
      onDone();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      loanId,
      annualRate: Number(annualRate),
      interestBasis,
      ruleType,
      effectiveFrom,
      remarks: remarks || undefined,
      customFormula: interestBasis === "CUSTOM" ? customFormula : undefined,
    });
  }

  return (
    <Card className="mb-6 p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <TextField
            label="Annual Rate (%)"
            type="number"
            step="0.01"
            min="0"
            value={annualRate}
            onChange={(e) => setAnnualRate(e.target.value)}
            required
          />
          <SelectField
            label="Interest Basis"
            value={interestBasis}
            onChange={(e) => setInterestBasis(e.target.value as InterestBasis)}
            required
          >
            {INTEREST_BASIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Rule Type"
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as InterestRuleType)}
          >
            {INTEREST_RULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Effective From"
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            required
          />
        </div>

        {interestBasis === "CUSTOM" && (
          <TextAreaField
            label="Custom Formula"
            value={customFormula}
            onChange={(e) => setCustomFormula(e.target.value)}
            placeholder="e.g. principal * rate * days / 365"
            required
          />
        )}

        <TextAreaField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

        {mutation.isError && (
          <div className="text-xs text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : "Failed to save interest configuration."}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Interest Config"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
