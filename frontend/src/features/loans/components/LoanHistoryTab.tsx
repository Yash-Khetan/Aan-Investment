import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ErrorState, SuccessState } from "../../../components/ui/States";
import { attachKpiRows } from "../../get-kpi/api";
import { ImportPanel } from "../../get-kpi/components/ImportPanel";
import { KpiLedgerSection } from "../../get-kpi/components/KpiLedgerSection";
import { LedgerTable as SheetTable } from "../../get-kpi/components/LedgerTable";
import { parseLedgerWorkbook } from "../../get-kpi/xlsxParser";
import type { KpiLedgerRow, KpiLedgerRowInput } from "../../get-kpi/types";
import type { Loan } from "../types";

/**
 * The loan's history from before it was kept here: upload the client's
 * ledger workbook, check the rows, and attach them to this loan. Rows are
 * stored exactly as they appear in the sheet.
 */
export function LoanHistoryTab({ loan }: { loan: Loan }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<KpiLedgerRow[]>([]);
  const [fileName, setFileName] = useState<string>();
  const [meta, setMeta] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleImport(file: File) {
    setIsImporting(true);
    setDone(null);
    setError(null);
    try {
      const parsed = await parseLedgerWorkbook(file);
      setRows(parsed.rows);
      setMeta(parsed.meta);
      setFileName(file.name);
    } finally {
      setIsImporting(false);
    }
  }

  async function handleAttach() {
    setAttaching(true);
    setError(null);
    try {
      const payload: KpiLedgerRowInput[] = rows.map(({ id: _id, ...rest }) => rest);
      const result = await attachKpiRows(loan.id, payload, fileName, meta);
      setDone(`Attached ${result.appended} rows. This loan now has ${result.totalRows} rows of imported history.`);
      setRows([]);
      setMeta(null);
      void queryClient.invalidateQueries({ queryKey: ["kpi-ledger", loan.id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach the rows.");
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ImportPanel onImport={handleImport} isImporting={isImporting} />

      {done && <SuccessState message={done} />}
      {error && <ErrorState message={error} />}

      {rows.length > 0 && (
        <Card className="flex flex-col gap-4 p-4">
          {meta && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Heading of the uploaded sheet</h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{meta}</p>
              <p className="mt-1 text-xs text-slate-500">
                Check this names {loan.borrowerName} and loan {loan.loanAccountNumber} before attaching.
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {rows.length} rows read from {fileName}
            </h3>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setRows([])} disabled={attaching}>
                Discard
              </Button>
              <Button onClick={handleAttach} disabled={attaching}>
                {attaching ? "Attaching…" : `Attach to ${loan.loanAccountNumber}`}
              </Button>
            </div>
          </div>
          <SheetTable
            rows={rows}
            busy={attaching}
            onEditRow={(id, patch) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))}
            onDeleteRow={(id) => setRows((prev) => prev.filter((r) => r.id !== id))}
          />
        </Card>
      )}

      <KpiLedgerSection loanId={loan.id} loanLabel={loan.loanAccountNumber} />
    </div>
  );
}
