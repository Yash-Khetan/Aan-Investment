import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { LoadingState, ErrorState } from "../../../components/ui/States";
import { createPenalRule, listPenalRules } from "../api";
import { PENAL_BASE_OPTIONS, PENAL_TYPE_OPTIONS } from "../types";
import type { PenalBase, PenalInterestRule, PenalType } from "../types";

function describePenalRule(rule: PenalInterestRule): string {
  const amount = rule.penalType === "PERCENTAGE" ? `${rule.penalRate}%` : `₹${rule.penalAmount}`;
  return `${amount} on ${rule.penalBase.replace(/_/g, " ").toLowerCase()}, grace ${rule.gracePeriodDays} day(s)`;
}

export function PenalRulesPanel({ loanId }: { loanId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [penalType, setPenalType] = useState<PenalType>("PERCENTAGE");
  const [penalRate, setPenalRate] = useState("");
  const [penalAmount, setPenalAmount] = useState("");
  const [penalBase, setPenalBase] = useState<PenalBase>("OVERDUE_INSTALLMENT_ONLY");
  const [gracePeriodDays, setGracePeriodDays] = useState("0");
  const [remarks, setRemarks] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["penal-rules", loanId],
    queryFn: () => listPenalRules(loanId),
  });

  const current = data?.find((r) => r.isCurrent);
  const history = data?.filter((r) => !r.isCurrent) ?? [];

  const mutation = useMutation({
    mutationFn: createPenalRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["penal-rules", loanId] });
      setShowForm(false);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      loanId,
      penalType,
      penalRate: penalType === "PERCENTAGE" ? Number(penalRate) : undefined,
      penalAmount: penalType === "FIXED_AMOUNT" ? Number(penalAmount) : undefined,
      penalBase,
      gracePeriodDays: Number(gracePeriodDays),
      remarks: remarks || undefined,
    });
  }

  return (
    <Card className="mb-6 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Penal Interest Rule</div>
        <Button variant="secondary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : current ? "+ Replace Rule" : "+ Set Penal Rule"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              label="Penal Type"
              value={penalType}
              onChange={(e) => setPenalType(e.target.value as PenalType)}
            >
              {PENAL_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </SelectField>
            {penalType === "PERCENTAGE" ? (
              <TextField
                label="Penal Rate (%)"
                type="number"
                step="0.01"
                min="0"
                value={penalRate}
                onChange={(e) => setPenalRate(e.target.value)}
                required
              />
            ) : (
              <TextField
                label="Penal Amount (INR)"
                type="number"
                step="0.01"
                min="0"
                value={penalAmount}
                onChange={(e) => setPenalAmount(e.target.value)}
                required
              />
            )}
            <SelectField
              label="Applies To"
              value={penalBase}
              onChange={(e) => setPenalBase(e.target.value as PenalBase)}
            >
              {PENAL_BASE_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b.replace(/_/g, " ")}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Grace Period (days)"
              type="number"
              min="0"
              value={gracePeriodDays}
              onChange={(e) => setGracePeriodDays(e.target.value)}
            />
          </div>
          <TextAreaField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

          {mutation.isError && (
            <div className="text-xs text-red-600">
              {mutation.error instanceof Error ? mutation.error.message : "Failed to save penal rule."}
            </div>
          )}

          <div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Penal Rule"}
            </Button>
          </div>
        </form>
      )}

      {isLoading && <LoadingState label="Loading penal rule..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load penal rule."} />}

      {data && !current && history.length === 0 && (
        <div className="text-xs text-slate-400">No penal interest rule configured for this loan yet.</div>
      )}

      {current && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Current: {describePenalRule(current)}
          {current.remarks && <span className="ml-1 text-emerald-700">— {current.remarks}</span>}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-medium text-slate-500">History</div>
          <div className="flex flex-col gap-1">
            {history.map((rule) => (
              <div key={rule.id} className="text-xs text-slate-500">
                {describePenalRule(rule)}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
