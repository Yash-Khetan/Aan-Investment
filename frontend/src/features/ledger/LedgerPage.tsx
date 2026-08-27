import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { StatCard } from "../../components/ui/Card";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatCurrency } from "../../lib/format";
import { ApiError } from "../../lib/api";
import { LoanSelect } from "../lookup/LoanSelect";
import { getLedger } from "./api";
import { AddEntryForm } from "./components/AddEntryForm";
import { RateSettingsPanel } from "./components/RateSettingsPanel";
import { LedgerTable } from "./components/LedgerTable";

export function LedgerPage() {
  const [loanId, setLoanId] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ledger", loanId],
    queryFn: () => getLedger(loanId),
    enabled: !!loanId,
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["ledger", loanId] });
  }

  const stats = data
    ? (() => {
        const totalDebit = data.entries.reduce((sum, r) => sum + (r.debit ? Number(r.debit) : 0), 0);
        const totalCredit = data.entries.reduce((sum, r) => sum + (r.credit ? Number(r.credit) : 0), 0);
        const balance = data.entries.length > 0 ? data.entries[data.entries.length - 1].balance : 0;
        return { totalDebit, totalCredit, balance };
      })()
    : null;

  return (
    <div>
      <PageHeader
        title="Ledger"
        description="A running account per loan account — record Payments and Receipts, and month-end Interest/TDS entries are calculated automatically."
      />

      <div className="flex flex-col gap-6">
        <div className="max-w-sm">
          <LoanSelect value={loanId} onChange={setLoanId} />
        </div>

        {!loanId && <EmptyState message="Select a loan to view or add records." />}

        {loanId && isLoading && <LoadingState label="Loading ledger..." />}

        {loanId && isError && (
          <ErrorState message={error instanceof ApiError ? error.message : "Failed to load the ledger."} />
        )}

        {loanId && data && (
          <>
            <AddEntryForm loanId={loanId} onAdded={refetch} />
            <RateSettingsPanel loanId={loanId} settings={data.settings} onSaved={refetch} />

            {stats && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Total Debit" value={formatCurrency(stats.totalDebit, 2)} />
                <StatCard label="Total Credit" value={formatCurrency(stats.totalCredit, 2)} />
                <StatCard
                  label="Current Balance"
                  value={`${formatCurrency(Math.abs(stats.balance), 2)} ${stats.balance >= 0 ? "Dr" : "Cr"}`}
                />
              </div>
            )}

            <LedgerTable entries={data.entries} loanId={loanId} onRateSaved={refetch} />
          </>
        )}
      </div>
    </div>
  );
}
