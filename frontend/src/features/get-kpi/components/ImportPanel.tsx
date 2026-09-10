import { useRef, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { ErrorState } from "../../../components/ui/States";

export function ImportPanel({
  onImport,
  isImporting,
}: {
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
      setError(err instanceof Error ? err.message : "Failed to read the file.");
    } finally {
      // allow re-selecting the same file
      e.target.value = "";
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Upload Ledger Excel</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          An <span className="font-medium">.xlsx</span> / <span className="font-medium">.xls</span> export with
          Date, Particulars, Vch Type, Vch No., Debit, Credit and Balance columns. Values are read exactly as they
          appear in the sheet.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
        {isImporting ? "Reading…" : "Choose Excel File"}
      </Button>

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
