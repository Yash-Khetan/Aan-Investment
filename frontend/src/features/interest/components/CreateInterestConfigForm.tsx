import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { createInterestConfig, getLoanInterestRate } from "../api";
import {
  CALCULATION_METHOD_OPTIONS,
  INCLUDE_OPENING_CLOSING_DAYS_OPTIONS,
  INTEREST_BASIS_OPTIONS,
  INTEREST_RULE_TYPES,
  RUNNING_BALANCE_UNSUPPORTED_BASES,
} from "../types";
import type { CalculationMethod, InterestBasis, InterestRuleType } from "../types";

export function CreateInterestConfigForm({ loanId, onDone }: { loanId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { data: annualRate, isLoading: isLoadingRate } = useQuery({
    queryKey: ["loan-interest-rate", loanId],
    queryFn: () => getLoanInterestRate(loanId),
  });
  const [interestBasis, setInterestBasis] = useState<InterestBasis>("ACTUAL_365");
  const [ruleType, setRuleType] = useState<InterestRuleType>("NORMAL");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [customFormula, setCustomFormula] = useState("");
  const [remarks, setRemarks] = useState("");
  const [calculationMethod, setCalculationMethod] = useState<CalculationMethod>("SIMPLE_INTEREST");
  const [includeOpeningClosingDays, setIncludeOpeningClosingDays] = useState(false);

  // Running Balance Method has no daily-rate concept for FULL_MONTH/CUSTOM — hide those options
  // instead of letting the operator pick an invalid combination and hit a server-side error.
  const basisOptions =
    calculationMethod === "RUNNING_BALANCE"
      ? INTEREST_BASIS_OPTIONS.filter((o) => !RUNNING_BALANCE_UNSUPPORTED_BASES.includes(o.value))
      : INTEREST_BASIS_OPTIONS;

  function handleMethodChange(method: CalculationMethod) {
    setCalculationMethod(method);
    if (method === "RUNNING_BALANCE" && RUNNING_BALANCE_UNSUPPORTED_BASES.includes(interestBasis)) {
      setInterestBasis("ACTUAL_365");
    }
  }

  const mutation = useMutation({
    mutationFn: createInterestConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interest-config", loanId] });
      onDone();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (annualRate === undefined) return;
    mutation.mutate({
      loanId,
      annualRate,
      interestBasis,
      ruleType,
      effectiveFrom,
      remarks: remarks || undefined,
      customFormula: interestBasis === "CUSTOM" ? customFormula : undefined,
      includeOpeningClosingDays,
      calculationMethod,
    });
  }

  return (
    <Card className="mb-6 p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Annual Rate (%)"
            type="number"
            step="0.01"
            min="0"
            value={isLoadingRate ? "Loading..." : (annualRate ?? "")}
            disabled
            readOnly
          />
          <SelectField
            label="Interest Basis"
            value={interestBasis}
            onChange={(e) => setInterestBasis(e.target.value as InterestBasis)}
            required
          >
            {basisOptions.map((o) => (
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
          <SelectField
            label="Method"
            value={calculationMethod}
            onChange={(e) => handleMethodChange(e.target.value as CalculationMethod)}
          >
            {CALCULATION_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Include Opening & Closing Days"
            value={includeOpeningClosingDays ? "yes" : "no"}
            onChange={(e) => setIncludeOpeningClosingDays(e.target.value === "yes")}
          >
            {INCLUDE_OPENING_CLOSING_DAYS_OPTIONS.map((o) => (
              <option key={String(o.value)} value={o.value ? "yes" : "no"}>
                {o.label}
              </option>
            ))}
          </SelectField>
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
          <Button type="submit" disabled={mutation.isPending || isLoadingRate || annualRate === undefined}>
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
