import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { StatCard } from "../../components/ui/Card";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatCurrency } from "../../lib/format";
import { ApiError } from "../../lib/api";
import { LoanSelect } from "../lookup/LoanSelect";
import { getLoan } from "../loans/api";
import { getDpdHistory, getLedger } from "./api";
import { AddEntryForm } from "./components/AddEntryForm";
import { BorrowerSummaryCard } from "./components/BorrowerSummaryCard";
import { LoanSummaryCard } from "./components/LoanSummaryCard";
import { LedgerTable } from "./components/LedgerTable";
import { DpdHistoryTable } from "./components/DpdHistoryTable";

export function LedgerPage() {
  const [loanId, setLoanId] = useState("");
  const queryClient = useQueryClient();

  /**
   * The selected loan drives the two read-only panels above the ledger: the
   * loan itself, and — via its borrowerId — the borrower behind it. Same query
   * key as the Loans module's detail view, so they share one cached record.
   */
  const {
    data: loan,
    isLoading: isLoanLoading,
    isError: isLoanError,
    error: loanError,
  } = useQuery({
    queryKey: ["loan", loanId],
    queryFn: () => getLoan(loanId),
    enabled: !!loanId,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ledger", loanId],
    queryFn: () => getLedger(loanId),
    enabled: !!loanId,
  });

  /**
   * DPD is keyed to the loan's repayment obligations, not to the ledger's own
   * rows, so it is fetched separately rather than riding along with the
   * ledger read.
   */
  const {
    data: dpd,
    isLoading: isDpdLoading,
    error: dpdError,
  } = useQuery({
    queryKey: ["ledger-dpd", loanId],
    queryFn: () => getDpdHistory(loanId),
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

        {loanId && isLoanLoading && <LoadingState label="Loading loan details..." />}

        {loanId && isLoanError && (
          <ErrorState
            message={loanError instanceof ApiError ? loanError.message : "Failed to load the loan details."}
          />
        )}

        {loanId && loan && (
          <>
            <BorrowerSummaryCard borrowerId={loan.borrowerId} />
            <LoanSummaryCard loan={loan} />
          </>
        )}

        {loanId && isLoading && <LoadingState label="Loading ledger..." />}

        {loanId && isError && (
          <ErrorState message={error instanceof ApiError ? error.message : "Failed to load the ledger."} />
        )}

        {loanId && data && (
          <>
            <AddEntryForm loanId={loanId} onAdded={refetch} />

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

            <LedgerTable entries={data.entries} />

            <DpdHistoryTable grid={dpd} isLoading={isDpdLoading} error={dpdError} />
          </>
        )}
      </div>
    </div>
  );
}
