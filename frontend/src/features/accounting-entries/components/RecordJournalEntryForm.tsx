import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/Field";
import type { JournalEntry } from "../types";

export function RecordJournalEntryForm({
  loanId,
  title,
  submitLabel,
  mutationFn,
  onDone,
}: {
  loanId: string;
  title: string;
  submitLabel: string;
  mutationFn: (input: { loanId: string; amount: number; entryDate: string }) => Promise<JournalEntry>;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState("");

  const mutation = useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-ledger", loanId] });
      onDone();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ loanId, amount: Number(amount), entryDate });
  }

  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <TextField
            label="Amount (INR)"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <TextField
            label="Entry Date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
          />
        </div>

        {mutation.isError && (
          <div className="text-xs text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : "Failed to record entry."}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : submitLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
