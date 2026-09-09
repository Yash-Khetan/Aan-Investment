import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/Field";
import { LoadingState, ErrorState, EmptyState } from "../../../components/ui/States";
import { LedgerTable } from "./LedgerTable";
import { getKpiLedger, attachKpiRows, updateKpiRow, deleteKpiRow } from "../api";
import type { KpiLedgerRowInput } from "../types";

const PAGE_SIZE = 30;

const EMPTY_ENTRY: KpiLedgerRowInput = {
  date: "",
  particulars: "",
  vchType: "",
  vchNo: "",
  debit: "",
  credit: "",
  balance: "",
};

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;
}

/**
 * A loan's KPI history — the rows imported from the client's old ledger plus any
 * entries added since. Append-only: new rows go after the existing ones. Values
 * are shown and stored exactly as typed / as they came from the sheet.
 */
export function KpiLedgerSection({ loanId, loanLabel }: { loanId: string; loanLabel?: string }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [entry, setEntry] = useState<KpiLedgerRowInput>(EMPTY_ENTRY);

  const key = ["kpi-ledger", loanId] as const;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...key, page],
    queryFn: () => getKpiLedger(loanId, page, PAGE_SIZE),
    enabled: !!loanId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const addMutation = useMutation({
    mutationFn: (row: KpiLedgerRowInput) => attachKpiRows(loanId, [row]),
    onSuccess: () => {
      setEntry(EMPTY_ENTRY);
      setAdding(false);
      invalidate();
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: KpiLedgerRowInput }) => updateKpiRow(loanId, id, patch),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKpiRow(loanId, id),
    onSuccess: invalidate,
  });

  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;
  const busy = editMutation.isPending || deleteMutation.isPending;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <SectionTitle>KPI Ledger — Client History</SectionTitle>
          {loanLabel && <p className="mt-0.5 text-xs text-slate-400">{loanLabel}</p>}
        </div>
        {!adding && (
          <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
            + Add Entry
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <TextField label="Date" value={entry.date ?? ""} onChange={(e) => setEntry({ ...entry, date: e.target.value })} placeholder="05-May-2025" />
            <TextField label="Vch Type" value={entry.vchType ?? ""} onChange={(e) => setEntry({ ...entry, vchType: e.target.value })} />
            <TextField label="Vch No." value={entry.vchNo ?? ""} onChange={(e) => setEntry({ ...entry, vchNo: e.target.value })} />
            <TextField label="Debit" value={entry.debit ?? ""} onChange={(e) => setEntry({ ...entry, debit: e.target.value })} placeholder="1,000.00" />
            <TextField label="Credit" value={entry.credit ?? ""} onChange={(e) => setEntry({ ...entry, credit: e.target.value })} placeholder="1,000.00" />
            <TextField label="Balance" value={entry.balance ?? ""} onChange={(e) => setEntry({ ...entry, balance: e.target.value })} placeholder="5,000.00 Cr" />
            <div className="col-span-2">
              <TextField label="Particulars" value={entry.particulars ?? ""} onChange={(e) => setEntry({ ...entry, particulars: e.target.value })} />
            </div>
          </div>
          {addMutation.isError && (
            <div className="mt-2">
              <ErrorState message={addMutation.error instanceof Error ? addMutation.error.message : "Failed to add entry."} />
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              onClick={() =>
                addMutation.mutate(
                  Object.fromEntries(
                    Object.entries(entry).map(([k, v]) => [k, v === "" ? null : v]),
                  ) as KpiLedgerRowInput,
                )
              }
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? "Adding…" : "Add Entry"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setAdding(false); setEntry(EMPTY_ENTRY); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading && <LoadingState label="Loading KPI ledger..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load KPI ledger."} />}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState message="No KPI history yet. Import the client's ledger from the Get KPI page, or add an entry above." />
      )}

      {rows.length > 0 && (
        <>
          <LedgerTable
            rows={rows}
            busy={busy}
            onEditRow={(id, patch) => editMutation.mutate({ id, patch })}
            onDeleteRow={(id) => {
              if (window.confirm("Delete this row from the loan's KPI history?")) deleteMutation.mutate(id);
            }}
          />
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>
              {data?.total ?? 0} rows · page {page} of {totalPages}
            </span>
            <span className="flex gap-1">
              <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Prev
              </Button>
              <Button variant="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Next
              </Button>
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
