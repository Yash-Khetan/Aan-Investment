import { useEffect, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/Field";
import { ErrorState } from "../../../components/ui/States";
import { updateSettings } from "../api";
import type { LedgerSettings } from "../types";

export function RateSettingsPanel({
  borrowerId,
  settings,
  onSaved,
}: {
  borrowerId: string;
  settings: LedgerSettings;
  onSaved: () => void;
}) {
  const [interestRate, setInterestRate] = useState(settings.defaultInterestRatePercent);
  const [tdsRate, setTdsRate] = useState(settings.defaultTdsRatePercent);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInterestRate(settings.defaultInterestRatePercent);
    setTdsRate(settings.defaultTdsRatePercent);
  }, [settings.defaultInterestRatePercent, settings.defaultTdsRatePercent]);

  async function handleSave() {
    const interest = Number.parseFloat(interestRate);
    const tds = Number.parseFloat(tdsRate);
    if (Number.isNaN(interest) || Number.isNaN(tds)) {
      setError("Enter valid rates.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await updateSettings(borrowerId, { defaultInterestRatePercent: interest, defaultTdsRatePercent: tds });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the default rates.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Default Rates</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Used automatically when next month's Interest/TDS entries are generated. Editing this does not change
          already-posted entries — edit those individually in the table below.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        <TextField
          label="Default Interest Rate (%)"
          type="number"
          step="0.01"
          value={interestRate}
          onChange={(e) => setInterestRate(e.target.value)}
        />
        <TextField
          label="Default TDS Rate (%)"
          type="number"
          step="0.01"
          value={tdsRate}
          onChange={(e) => setTdsRate(e.target.value)}
        />
        <Button type="button" onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? "Saving…" : "Save Defaults"}
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorState message={error} />
        </div>
      )}
    </Card>
  );
}
