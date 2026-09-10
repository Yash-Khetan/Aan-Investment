import { useState } from "react";
import { PageHeader } from "../../components/Layout";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { SelectField } from "../../components/ui/Field";
import { EmptyState, ErrorState, SuccessState } from "../../components/ui/States";
import { formatCurrency } from "../../lib/format";
import { useLoanLookup } from "../lookup/hooks";
import { ImportPanel } from "./components/ImportPanel";
import { LedgerTable } from "./components/LedgerTable";
import { parseLedgerWorkbook } from "./xlsxParser";
import { attachKpiRows } from "./api";
import type { KpiLedgerRow, KpiLedgerRowInput } from "./types";

export function GetKpiPage() {
  const loans = useLoanLookup();
  const [rows, setRows] = useState<KpiLedgerRow[]>([]);
  const [fileName, setFileName] = useState<string | undefined>();
  const [meta, setMeta] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [loanId, setLoanId] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachDone, setAttachDone] = useState<string | null>(null);

  const selectedLoan = loans.data?.find((l) => l.id === loanId);

  function loanLabel(l: NonNullable<typeof loans.data>[number]): string {
    const outstanding = formatCurrency(l.outstandingPrincipal, 0);
    return `${l.loanAccountNumber} — ${l.customerName} — ${l.status} — ${outstanding} outstanding`;
  }

  async function handleImport(file: File) {
    setIsImporting(true);
    setAttachDone(null);
    setAttachError(null);
    try {
      const parsed = await parseLedgerWorkbook(file);
      setRows(parsed.rows);
      setMeta(parsed.meta);
      setFileName(file.name);
    } finally {
      setIsImporting(false);
    }
  }

  function handleEditRow(id: string, patch: KpiLedgerRowInput) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function handleDeleteRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }
  function handleClear() {
    setRows([]);
    setMeta(null);
    setFileName(undefined);
    setLoanId("");
    setAttachError(null);
    setAttachDone(null);
  }

  async function handleAttach() {
    if (!loanId || rows.length === 0) return;
    setAttaching(true);
    setAttachError(null);
    setAttachDone(null);
    try {
      const payload: KpiLedgerRowInput[] = rows.map(({ id: _id, ...rest }) => rest);
      const result = await attachKpiRows(loanId, payload, fileName, meta);
      setAttachDone(
        `Attached ${result.appended} row${result.appended === 1 ? "" : "s"} to ${
          selectedLoan ? `${selectedLoan.loanAccountNumber} — ${selectedLoan.customerName}` : "the loan"
        }. It now has ${result.totalRows} in its KPI history.`,
      );
      handleClear();
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Failed to attach rows to the loan.");
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Get KPI"
        description="Upload a client's historical ledger Excel, review the rows, then attach them to a loan as its opening history."
      />

      <div className="space-y-6">
        <ImportPanel onImport={handleImport} isImporting={isImporting} />

        {attachDone && <SuccessState message={attachDone} />}

        {rows.length === 0 ? (
          !attachDone && <EmptyState message="Upload an Excel ledger above to get started." />
        ) : (
          <>
            {meta && (
              <Card className="p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">From the uploaded sheet</h2>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{meta}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Check the client name and loan id here match the loan you attach to below.
                </p>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Parsed {rows.length} rows</h2>
              <Button variant="ghost" onClick={handleClear}>
                Clear &amp; upload another file
              </Button>
            </div>

            <LedgerTable rows={rows} onEditRow={handleEditRow} onDeleteRow={handleDeleteRow} />

            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Attach to a loan</h2>
              {loans.isError && <ErrorState message="Could not load the list of loans." />}
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-96 flex-1">
                  <SelectField
                    label="Loan"
                    value={loanId}
                    onChange={(e) => setLoanId(e.target.value)}
                    disabled={loans.isLoading || attaching}
                  >
                    <option value="">Select a loan…</option>
                    {loans.data?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {loanLabel(l)}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <Button onClick={handleAttach} disabled={!loanId || attaching}>
                  {attaching ? "Attaching…" : "Attach to loan"}
                </Button>
              </div>
              {selectedLoan && (
                <p className="mt-2 text-xs text-slate-500">
                  Attaching to <span className="font-medium text-slate-700">{loanLabel(selectedLoan)}</span>
                </p>
              )}
              {attachError && (
                <div className="mt-3">
                  <ErrorState message={attachError} />
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
