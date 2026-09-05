import { useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { ErrorState } from "../../../components/ui/States";
import { createEntry } from "../api";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddEntryForm({ loanId, onAdded }: { loanId: string; onAdded: () => void }) {
  const [entryDate, setEntryDate] = useState(todayIso());
  const [vchType, setVchType] = useState<"PAYMENT" | "RECEIPT">("PAYMENT");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number.parseFloat(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await createEntry(loanId, { entryDate, vchType, amount: parsedAmount, narration: narration || undefined });
      setAmount("");
      setNarration("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add the record.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Add Record</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <TextField label="Date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
        <SelectField label="Type" value={vchType} onChange={(e) => setVchType(e.target.value as "PAYMENT" | "RECEIPT")}>
          <option value="PAYMENT">Payment (paid to borrower)</option>
          <option value="RECEIPT">Receipt (received from borrower)</option>
        </SelectField>
        <TextField
          label="Amount (INR)"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <div className="lg:col-span-2">
          <TextAreaField label="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} />
        </div>
        <div className="lg:col-span-5">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Adding…" : "Add Record"}
          </Button>
        </div>
      </form>
      {error && (
        <div className="mt-3">
          <ErrorState message={error} />
        </div>
      )}
    </Card>
  );
}
