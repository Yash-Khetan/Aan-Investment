import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Table, type Column } from "../../components/ui/Table";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatCurrency, formatDate } from "../../lib/format";
import { LoanSelect } from "../lookup/LoanSelect";
import { LoanDetailView } from "../loans/components/LoanDetailView";
import { listDisbursements } from "./api";
import type { Disbursement } from "./types";
import { RecordDisbursementForm } from "./components/RecordDisbursementForm";

const COLUMNS: Column<Disbursement>[] = [
  { key: "trancheNumber", header: "Sr. No.", render: (r) => r.trancheNumber },
  { key: "disbursementDate", header: "Disbursement Date", render: (r) => formatDate(r.disbursementDate) },
  {
    key: "amount",
    header: "Amount",
    render: (r) => <span className="font-medium">{formatCurrency(r.amount)}</span>,
  },
  { key: "remarks", header: "Remarks", render: (r) => r.remarks || <span className="text-slate-400">—</span> },
];

export function DisbursementsPage() {
  const [loanId, setLoanId] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["disbursements", loanId],
    queryFn: () => listDisbursements(loanId),
    enabled: loanId !== "",
  });

  return (
    <div>
      <PageHeader
        title="Disbursements"
        description="Tranche-wise disbursement records for a loan."
      />

      {!loanId && (
        <div className="mb-6 w-full sm:w-96">
          <LoanSelect
            value={loanId}
            onChange={(id) => {
              setLoanId(id);
              setShowForm(false);
            }}
          />
        </div>
      )}

      {!loanId && <EmptyState message="Select a loan to view or record disbursements." />}

      {loanId && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-4">
            <LoanDetailView loanId={loanId} />
          </Card>

          <div>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="w-full sm:w-96">
                <LoanSelect
                  value={loanId}
                  onChange={(id) => {
                    setLoanId(id);
                    setShowForm(false);
                  }}
                />
              </div>
              <Button variant="secondary" onClick={() => setShowForm((f) => !f)}>
                {showForm ? "Cancel" : "+ Add Disbursement"}
              </Button>
            </div>

            {showForm && <RecordDisbursementForm loanId={loanId} onDone={() => setShowForm(false)} />}

            {isLoading && <LoadingState label="Loading disbursements..." />}
            {isError && (
              <ErrorState message={error instanceof Error ? error.message : "Failed to load disbursements."} />
            )}
            {data && data.length === 0 && <EmptyState message="No disbursements recorded for this loan yet." />}
            {data && data.length > 0 && <Table columns={COLUMNS} rows={data} rowKey={(row) => row.id} />}
          </div>
        </div>
      )}
    </div>
  );
}
