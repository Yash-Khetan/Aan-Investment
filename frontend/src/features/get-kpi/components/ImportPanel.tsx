import { useRef, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/Field";
import { ErrorState } from "../../../components/ui/States";
import type { ImportSettings } from "../types";

export function ImportPanel({
  settings,
  onSettingsChange,
  onImport,
  isImporting,
}: {
  settings: ImportSettings;
  onSettingsChange: (settings: ImportSettings) => void;
  onImport: (file: File) => Promise<void>;
  isImporting: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    try {
      await onImport(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import the file.");
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Import Ledger</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Upload an Excel ledger with Date, Particulars, Vch Type, Vch No., Debit, Credit and Balance columns.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        <TextField
          label="Standard Interest Rate (%)"
          type="number"
          step="0.01"
          value={settings.standardInterestRate}
          onChange={(e) =>
            onSettingsChange({ ...settings, standardInterestRate: Number.parseFloat(e.target.value) || 0 })
          }
        />
        <TextField
          label="Standard TDS Rate (%)"
          type="number"
          step="0.01"
          value={settings.standardTdsRate}
          onChange={(e) => onSettingsChange({ ...settings, standardTdsRate: Number.parseFloat(e.target.value) || 0 })}
        />
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="w-full sm:w-auto"
          >
            {isImporting ? "Importing…" : "Choose Excel File"}
          </Button>
        </div>
      </div>

      {fileName && !error && (
        <p className="mt-2 text-xs text-slate-500">
          Loaded <span className="font-medium text-slate-700">{fileName}</span>
        </p>
      )}
      {error && (
        <div className="mt-3">
          <ErrorState message={error} />
        </div>
      )}
    </Card>
  );
}
