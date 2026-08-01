import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { Table, type Column } from "../../components/ui/Table";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatCurrency, formatDate } from "../../lib/format";
import { LoanSelect } from "../lookup/LoanSelect";
import { getLedger, recordWriteOff } from "./api";
import type { JournalEntry } from "./types";
import { RecordJournalEntryForm } from "./components/RecordJournalEntryForm";

const COLUMNS: Column<JournalEntry>[] = [
  { key: "entryNumber", header: "Entry #", render: (r) => r.entryNumber },
  { key: "entryDate", header: "Date", render: (r) => formatDate(r.entryDate) },
  { key: "entryType", header: "Type", render: (r) => r.entryType.replace(/_/g, " ") },
  {
    key: "debit",
    header: "Debit Account",
    render: (r) => r.lines.find((l) => Number(l.debitAmount) > 0)?.accountName ?? "—",
  },
  {
    key: "credit",
    header: "Credit Account",
    render: (r) => r.lines.find((l) => Number(l.creditAmount) > 0)?.accountName ?? "—",
  },
  {
    key: "amount",
    header: "Amount",
    render: (r) => {
      const debitLine = r.lines.find((l) => Number(l.debitAmount) > 0);
      return <span className="font-medium">{formatCurrency(debitLine?.debitAmount ?? 0)}</span>;
    },
  },
  { key: "narration", header: "Narration", render: (r) => r.narration || <span className="text-slate-400">—</span> },
  { key: "isPosted", header: "Posted", render: (r) => (r.isPosted ? "Yes" : "No") },
  { key: "isExported", header: "Exported", render: (r) => (r.isExported ? "Yes" : "No") },
];

type ActiveForm = "write-off" | null;

export function AccountingLedgerPage() {
  const [loanId, setLoanId] = useState("");
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["journal-ledger", loanId],
    queryFn: () => getLedger(loanId),
    enabled: loanId !== "",
  });

  return (
    <div>
      <PageHeader
        title="Accounting Ledger"
        description="Journal entries for disbursement, interest accrual/receipt, principal receipt, penal interest and write-off (SRS §18)."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="w-full sm:w-96">
          <LoanSelect
            value={loanId}
            onChange={(id) => {
              setLoanId(id);
              setActiveForm(null);
            }}
          />
        </div>
        {loanId && (
          <Button variant="secondary" onClick={() => setActiveForm((f) => (f === "write-off" ? null : "write-off"))}>
            {activeForm === "write-off" ? "Cancel" : "+ Record Write-Off"}
          </Button>
        )}
      </div>

      {!loanId && <EmptyState message="Select a loan to view or post journal entries." />}

      {loanId && activeForm === "write-off" && (
        <RecordJournalEntryForm
          loanId={loanId}
          title="Record Write-Off"
          submitLabel="Record Write-Off"
          mutationFn={recordWriteOff}
          onDone={() => setActiveForm(null)}
        />
      )}

      {loanId && isLoading && <LoadingState label="Loading ledger..." />}
      {loanId && isError && (
        <ErrorState message={error instanceof Error ? error.message : "Failed to load ledger."} />
      )}
      {loanId && data && data.length === 0 && <EmptyState message="No journal entries recorded for this loan yet." />}
      {loanId && data && data.length > 0 && <Table columns={COLUMNS} rows={data} rowKey={(row) => row.id} />}
    </div>
  );
}
