import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { StatCard } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Table, type Column } from "../../components/ui/Table";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatCurrency, formatDate } from "../../lib/format";
import { ApiError } from "../../lib/api";
import { LoanSelect } from "../lookup/LoanSelect";
import { getSchedule } from "../repayment/api";
import { INSTALLMENT_STATUS_LABELS, getDaysLate, isInstallmentOverdue } from "../repayment/types";
import type { Installment } from "../repayment/types";
import { getPaymentHistory } from "./api";
import type { PaymentWithAllocations } from "./types";
import { RecordPaymentForm } from "./components/RecordPaymentForm";

function buildHistoryColumns(installmentsById: Map<string, Installment>): Column<PaymentWithAllocations>[] {
  return [
    { key: "paymentRefNumber", header: "Reference", render: (r) => r.paymentRefNumber },
    { key: "paymentDate", header: "Date", render: (r) => formatDate(r.paymentDate) },
    {
      key: "amount",
      header: "Amount",
      render: (r) => <span className="font-medium">{formatCurrency(r.amount, 2)}</span>,
    },
    { key: "paymentMode", header: "Mode", render: (r) => r.paymentMode.replace(/_/g, " ") },
    {
      key: "penalty",
      header: "Penalty",
      render: (r) => {
        const totalPenalty = r.allocations.reduce((sum, a) => sum + Number(a.penalInterestApplied), 0);
        return formatCurrency(totalPenalty, 2);
      },
    },
    {
      key: "appliedTo",
      header: "Applied To Installment(s)",
      render: (r) => {
        const linked = r.allocations.filter((a): a is typeof a & { installmentId: string } => !!a.installmentId);
        if (linked.length === 0) return <span className="text-slate-400">Not linked to an installment</span>;
        return (
          <div className="flex flex-col gap-1">
            {linked.map((a) => {
              const installment = installmentsById.get(a.installmentId);
              if (!installment) return null;
              // This payment's own timing (was it made on time?) and the installment's current
              // status (is it, as of today, still short?) are two different questions — shown
              // separately rather than merged into one label, so they can't look contradictory.
              const daysLate = getDaysLate(installment.dueDate, r.paymentDate);
              const overdueNow = isInstallmentOverdue(installment);
              return (
                <div key={a.id} className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">#{installment.installmentNumber}</span>
                  <Badge status={installment.status} label={INSTALLMENT_STATUS_LABELS[installment.status]} />
                  {daysLate > 0 && (
                    <span className="text-xs text-slate-400">(this payment was {daysLate}d late)</span>
                  )}
                  {overdueNow && <span className="text-xs font-medium text-orange-700">still overdue today</span>}
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      key: "transactionRef",
      header: "Transaction Ref",
      render: (r) => r.transactionRef || <span className="text-slate-400">—</span>,
    },
    { key: "remarks", header: "Remarks", render: (r) => r.remarks || <span className="text-slate-400">—</span> },
  ];
}

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

  const installmentsById = useMemo(
    () => new Map((data?.installments ?? []).map((i) => [i.id, i])),
    [data?.installments],
  );
  const historyColumns = useMemo(() => buildHistoryColumns(installmentsById), [installmentsById]);

  // Sum of (totalAmount - paidTotal) across every installment in the current schedule — the amount
  // still owed over the full repayment schedule, not just what's overdue today.
  const outstandingBalance = (data?.installments ?? []).reduce(
    (sum, i) => sum + (Number(i.totalAmount) - Number(i.paidTotal)),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Record a repayment against a loan — applied automatically via its appropriation waterfall (penalty → interest → principal)."
      />

      <div className="mb-6 w-full sm:w-96">
        <LoanSelect value={loanId} onChange={setLoanId} />
      </div>

      {!loanId && <EmptyState message="Select a loan to record a payment." />}

      {loanId && data && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Outstanding Balance" value={formatCurrency(outstandingBalance, 2)} />
          <StatCard label="Installments Remaining" value={String(outstandingInstallments.length)} />
        </div>
      )}

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
            <Table columns={historyColumns} rows={history.data} rowKey={(row) => row.id} />
          )}
        </div>
      )}
    </div>
  );
}
