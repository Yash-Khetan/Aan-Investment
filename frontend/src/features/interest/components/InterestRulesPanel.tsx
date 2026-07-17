import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/Field";
import { LoadingState, ErrorState } from "../../../components/ui/States";
import { createInterestRule, deleteInterestRule, listInterestRules } from "../api";

export function InterestRulesPanel({ interestConfigId }: { interestConfigId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [rate, setRate] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("");
  const [remarks, setRemarks] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["interest-rules", interestConfigId],
    queryFn: () => listInterestRules(interestConfigId),
  });

  const createMutation = useMutation({
    mutationFn: createInterestRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interest-rules", interestConfigId] });
      setShowForm(false);
      setFromMonth("");
      setToMonth("");
      setRate("");
      setTriggerEvent("");
      setRemarks("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInterestRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interest-rules", interestConfigId] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      interestConfigId,
      fromMonth: fromMonth ? Number(fromMonth) : undefined,
      toMonth: toMonth ? Number(toMonth) : undefined,
      rate: Number(rate),
      triggerEvent: triggerEvent || undefined,
      remarks: remarks || undefined,
    });
  }

  return (
    <Card className="mb-6 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Step-Up / Step-Down / Event Rules
        </div>
        <Button variant="secondary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add Rule"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TextField
              label="From Month"
              type="number"
              min="0"
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value)}
            />
            <TextField
              label="To Month"
              type="number"
              min="0"
              value={toMonth}
              onChange={(e) => setToMonth(e.target.value)}
            />
            <TextField
              label="Rate (%)"
              type="number"
              step="0.01"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
            />
            <TextField
              label="Trigger Event"
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value)}
              placeholder="e.g. PAYMENT_DELAYED"
            />
          </div>
          <TextField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

          {createMutation.isError && (
            <div className="text-xs text-red-600">
              {createMutation.error instanceof Error ? createMutation.error.message : "Failed to add rule."}
            </div>
          )}

          <div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Add Rule"}
            </Button>
          </div>
        </form>
      )}

      {isLoading && <LoadingState label="Loading rules..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load rules."} />}

      {data && data.length === 0 && (
        <div className="text-xs text-slate-400">No slab or event rules configured for this interest config.</div>
      )}

      {data && data.length > 0 && (
        <div className="flex flex-col gap-2">
          {data.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{rule.rate}%</span>
                {rule.fromMonth !== null && rule.toMonth !== null && (
                  <span className="text-slate-500">
                    {" "}
                    — months {rule.fromMonth}–{rule.toMonth}
                  </span>
                )}
                {rule.triggerEvent && <span className="text-slate-500"> — on {rule.triggerEvent}</span>}
                {rule.remarks && <span className="ml-2 text-xs text-slate-400">{rule.remarks}</span>}
              </div>
              <Button
                variant="ghost"
                onClick={() => deleteMutation.mutate(rule.id)}
                disabled={deleteMutation.isPending}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
