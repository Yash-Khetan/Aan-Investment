import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Badge } from "../../components/ui/Badge";
import { Table, type Column } from "../../components/ui/Table";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatCurrency, formatDate } from "../../lib/format";
import { ApiError } from "../../lib/api";
import { LoanSelect } from "../lookup/LoanSelect";
import { getSchedule } from "../repayment/api";
import { getPaymentHistory } from "./api";
import type { Payment } from "./types";
import { RecordPaymentForm } from "./components/RecordPaymentForm";

const HISTORY_COLUMNS: Column<Payment>[] = [
  { key: "paymentRefNumber", header: "Reference", render: (r) => r.paymentRefNumber },
  { key: "paymentDate", header: "Date", render: (r) => formatDate(r.paymentDate) },
  { key: "amount", header: "Amount", render: (r) => <span className="font-medium">{formatCurrency(r.amount)}</span> },
  { key: "paymentMode", header: "Mode", render: (r) => r.paymentMode.replace(/_/g, " ") },
  { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
  { key: "transactionRef", header: "Transaction Ref", render: (r) => r.transactionRef || <span className="text-slate-400">—</span> },
  { key: "remarks", header: "Remarks", render: (r) => r.remarks || <span className="text-slate-400">—</span> },
];

export function PaymentsPage() {
  const [loanId, setLoanId] = useState("");

  const { data, error } = useQuery({
    queryKey: ["repayment-schedule", loanId],
    queryFn: () => getSchedule(loanId),
    enabled: loanId !== "",
    retry: false,
  });

  const history = useQuery({
    queryKey: ["payments", loanId],
    queryFn: () => getPaymentHistory(loanId),
    enabled: loanId !== "",
  });

  const scheduleNotFound = error instanceof ApiError && error.status === 404;
  const outstandingInstallments = (data?.installments ?? []).filter(
    (i) => i.status === "PENDING" || i.status === "PARTIAL",
  );

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Record a repayment against a loan — applied automatically via its appropriation waterfall (penalty → interest → principal)."
      />

      <div className="mb-6 w-96">
        <LoanSelect value={loanId} onChange={setLoanId} />
      </div>

      {!loanId && <EmptyState message="Select a loan to record a payment." />}

      {loanId && scheduleNotFound && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This loan has no repayment schedule yet, so there are no installments to apply the payment
          against — you can still record the payment and enter outstanding amounts manually.
        </div>
      )}

      {loanId && <RecordPaymentForm loanId={loanId} installments={outstandingInstallments} />}

      {loanId && (
        <div className="mt-6">
          <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Payment History</div>
          {history.isLoading && <LoadingState label="Loading payment history..." />}
          {history.isError && (
            <ErrorState
              message={history.error instanceof Error ? history.error.message : "Failed to load payment history."}
            />
          )}
          {history.data && history.data.length === 0 && (
            <EmptyState message="No payments recorded for this loan yet." />
          )}
          {history.data && history.data.length > 0 && (
            <Table columns={HISTORY_COLUMNS} rows={history.data} rowKey={(row) => row.id} />
          )}
        </div>
      )}
    </div>
  );
}
