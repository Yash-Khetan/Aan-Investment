import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button } from "../../../components/ui/Button";
import { ErrorState, LoadingState } from "../../../components/ui/States";
import { getKpiLedger } from "../api";

const PAGE_SIZE = 30;

/**
 * Every imported row exactly as the sheets showed it — the record of what was
 * imported. Read-only: the ledger entries posted from these rows are what the
 * loan's figures come from, so the sheet is changed only by removing its
 * import and importing a corrected sheet.
 */
export function KpiLedgerSection({ loanId }: { loanId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["kpi-ledger", loanId, page],
    queryFn: () => getKpiLedger(loanId, page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  if (isLoading) return <LoadingState label="Loading imported rows..." />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Could not load the imported rows."} />;
  if (!data || data.total === 0) return null;

  return (
    <section>
      <h3 className="mb-1 text-base font-semibold text-slate-900">Rows as imported</h3>
      <p className="mb-3 text-sm text-slate-500">Exactly as the sheets showed them. {data.total} rows.</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Date", "Particulars", "Vch type", "Vch no.", "Debit", "Credit", "Balance"].map((h) => (
                <th
                  key={h}
                  className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-slate-600 ${
                    ["Debit", "Credit", "Balance"].includes(h) ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.date ?? ""}</td>
                <td className="max-w-md px-4 py-2 text-slate-700">
                  {r.drCr && <span className="mr-1.5 text-xs text-slate-400">{r.drCr}</span>}
                  {r.particulars}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.vchType ?? ""}</td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.vchNo ?? ""}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-800">{r.debit ?? ""}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-800">{r.credit ?? ""}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-800">{r.balance ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm text-slate-500">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          Page {page} of {data.totalPages}
          <Button variant="ghost" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
