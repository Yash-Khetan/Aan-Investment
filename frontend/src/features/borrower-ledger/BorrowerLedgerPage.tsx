import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { StatCard } from "../../components/ui/Card";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatCurrency } from "../../lib/format";
import { ApiError } from "../../lib/api";
import { BorrowerSelect } from "../lookup/BorrowerSelect";
import { getLedger } from "./api";
import { AddEntryForm } from "./components/AddEntryForm";
import { RateSettingsPanel } from "./components/RateSettingsPanel";
import { LedgerTable } from "./components/LedgerTable";

export function BorrowerLedgerPage() {
  const [borrowerId, setBorrowerId] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["borrower-ledger", borrowerId],
    queryFn: () => getLedger(borrowerId),
    enabled: !!borrowerId,
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["borrower-ledger", borrowerId] });
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
        title="Borrower Ledger"
        description="A running account per borrower — record Payments and Receipts, and month-end Interest/TDS entries are calculated automatically."
      />

      <div className="flex flex-col gap-6">
        <div className="max-w-sm">
          <BorrowerSelect value={borrowerId} onChange={setBorrowerId} />
        </div>

        {!borrowerId && <EmptyState message="Select a borrower to view or add records." />}

        {borrowerId && isLoading && <LoadingState label="Loading ledger..." />}

        {borrowerId && isError && (
          <ErrorState message={error instanceof ApiError ? error.message : "Failed to load the ledger."} />
        )}

        {borrowerId && data && (
          <>
            <AddEntryForm borrowerId={borrowerId} onAdded={refetch} />
            <RateSettingsPanel borrowerId={borrowerId} settings={data.settings} onSaved={refetch} />

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

            <LedgerTable entries={data.entries} borrowerId={borrowerId} onRateSaved={refetch} />
          </>
        )}
      </div>
    </div>
  );
}
