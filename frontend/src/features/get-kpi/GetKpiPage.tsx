import { useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/States";
import { ImportPanel } from "./components/ImportPanel";
import { LedgerTable } from "./components/LedgerTable";
import { KpiDashboard } from "./components/KpiDashboard";
import { parseLedgerWorkbook } from "./xlsxParser";
import { downloadLedgerCsv } from "./csvExport";
import type { ImportSettings, LedgerRow, RowParameter } from "./types";

export function GetKpiPage() {
  const [settings, setSettings] = useState<ImportSettings>({ standardInterestRate: 21, standardTdsRate: 10 });
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  async function handleImport(file: File) {
    setIsImporting(true);
    try {
      const parsed = await parseLedgerWorkbook(file);
      const seeded = parsed.map((row) => ({
        ...row,
        parameters: [
          { id: `${row.id}-interest`, name: "interest", value: settings.standardInterestRate / 100, isPercent: true },
          { id: `${row.id}-tds`, name: "tds", value: settings.standardTdsRate / 100, isPercent: true },
        ] satisfies RowParameter[],
      }));
      setRows(seeded);
    } finally {
      setIsImporting(false);
    }
  }

  function handleUpdateParameters(rowId: string, parameters: RowParameter[]) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, parameters } : r)));
  }

  function handleUpdateOutput(rowId: string, output: LedgerRow["output"]) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, output } : r)));
  }

  function handleReset() {
    setRows([]);
  }

  function handleDownload() {
    downloadLedgerCsv(rows);
  }

  return (
    <div>
      <PageHeader
        title="Get KPI"
        description="Import a ledger, define custom per-row formulas, and explore an interactive KPI dashboard."
      />

      <div className="space-y-6">
        <ImportPanel
          settings={settings}
          onSettingsChange={setSettings}
          onImport={handleImport}
          isImporting={isImporting}
        />

        {rows.length === 0 ? (
          <EmptyState message="Import an Excel ledger above to get started." />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Ledger Data ({rows.length} rows)</h2>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleDownload}>
                  Download Report (CSV)
                </Button>
                <Button variant="ghost" onClick={handleReset}>
                  Clear &amp; Import Another File
                </Button>
              </div>
            </div>

            <LedgerTable rows={rows} onUpdateParameters={handleUpdateParameters} onUpdateOutput={handleUpdateOutput} />

            <div>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">KPI Dashboard</h2>
              <KpiDashboard rows={rows} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
