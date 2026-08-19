import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/Field";
import { ErrorState } from "../../../components/ui/States";
import { editJournalRate } from "../api";
import type { LedgerEntry } from "../types";

export function JournalRateEditor({
  entry,
  borrowerId,
  onSaved,
}: {
  entry: LedgerEntry;
  borrowerId: string;
  onSaved: () => void;
}) {
  const [rate, setRate] = useState(entry.ratePercent ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const ratePercent = Number.parseFloat(rate);
    if (Number.isNaN(ratePercent)) {
      setError("Enter a valid rate.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await editJournalRate(borrowerId, entry.id, ratePercent);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the rate.");
    } finally {
      setIsSaving(false);
    }
  }

  const label = entry.vchType === "JOURNAL_INTEREST" ? "Interest Rate (%)" : "TDS Rate (%)";

  return (
    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <TextField label={label} type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Recalculate & Save"}
        </Button>
        <p className="text-xs text-slate-400">
          Recalculates this entry's amount at the new rate. Only affects this entry
          {entry.vchType === "JOURNAL_INTEREST" ? " and its paired TDS entry" : ""} — other months are left untouched.
        </p>
      </div>
      {error && (
        <div className="mt-2">
          <ErrorState message={error} />
        </div>
      )}
    </div>
  );
}
