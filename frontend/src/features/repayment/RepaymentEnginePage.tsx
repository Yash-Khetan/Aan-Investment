import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Table, type Column } from "../../components/ui/Table";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatCurrency, formatDate } from "../../lib/format";
import { ApiError } from "../../lib/api";
import { LoanSelect } from "../lookup/LoanSelect";
import { getSchedule } from "./api";
import { INSTALLMENT_STATUS_LABELS, getDaysLate, getDaysOverdue, isInstallmentOverdue } from "./types";
import type { Installment } from "./types";
import { GenerateScheduleForm } from "./components/GenerateScheduleForm";

const COLUMNS: Column<Installment>[] = [
  { key: "installmentNumber", header: "#", render: (r) => r.installmentNumber },
  { key: "dueDate", header: "Due Date", render: (r) => formatDate(r.dueDate) },
  { key: "principalAmount", header: "Principal", render: (r) => formatCurrency(r.principalAmount, 2) },
  { key: "interestAmount", header: "Interest", render: (r) => formatCurrency(r.interestAmount, 2) },
  {
    key: "totalAmount",
    header: "Total",
    render: (r) => <span className="font-medium">{formatCurrency(r.totalAmount, 2)}</span>,
  },
  { key: "paidTotal", header: "Paid", render: (r) => formatCurrency(r.paidTotal, 2) },
  { key: "penaltyPaid", header: "Penalty", render: (r) => formatCurrency(r.penaltyPaid, 2) },
  {
    key: "status",
    header: "Status",
    // Always the installment's real status — never overwritten with a synthetic "Overdue" value,
    // so you can always tell PARTIAL (some money in) apart from PENDING (none in). Lateness is
    // shown separately in the Days Overdue column instead of being folded in here.
    render: (r) => <Badge status={r.status} label={INSTALLMENT_STATUS_LABELS[r.status]} />,
  },
  {
    key: "daysOverdue",
    header: "Days Overdue",
    render: (r) => {
      // Still unpaid/short and past due — urgent, needs collection action.
      if (isInstallmentOverdue(r)) {
        return <span className="font-medium text-orange-700">{getDaysOverdue(r.dueDate)}</span>;
      }
      // Already fully settled, but the payment came in after the due date — informational only,
      // shown in a muted tone since there's nothing outstanding to chase anymore.
      if (r.status === "SUCCESS" && r.paidDate) {
        const daysLate = getDaysLate(r.dueDate, r.paidDate);
        if (daysLate > 0) {
          return <span className="text-slate-500">Paid {daysLate}d late</span>;
        }
      }
      return <span className="text-slate-400">—</span>;
    },
  },
  { key: "paidDate", header: "Paid Date", render: (r) => formatDate(r.paidDate) },
];

export function RepaymentEnginePage() {
  const [loanId, setLoanId] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["repayment-schedule", loanId],
    queryFn: () => getSchedule(loanId),
    enabled: loanId !== "",
    retry: false,
  });

  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <div>
      <PageHeader
        title="Repayment Engine"
        description="Generate and review the repayment schedule for a loan — EMI, bullet, interest-only or structured."
      />

      <div className="mb-6 flex items-end gap-3">
        <div className="w-96">
          <LoanSelect
            value={loanId}
            onChange={(id) => {
              setLoanId(id);
              setShowForm(false);
            }}
          />
        </div>
        {loanId && (
          <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ Generate Schedule"}</Button>
        )}
      </div>

      {!loanId && <EmptyState message="Select a loan to view or generate its repayment schedule." />}

      {loanId && showForm && <GenerateScheduleForm loanId={loanId} onDone={() => setShowForm(false)} />}

      {loanId && isLoading && <LoadingState label="Loading repayment schedule..." />}
      {loanId && isError && !notFound && (
        <ErrorState message={error instanceof Error ? error.message : "Failed to load repayment schedule."} />
      )}
      {loanId && notFound && !showForm && (
        <EmptyState message="No repayment schedule generated for this loan yet." />
      )}

      {loanId && data && (
        <>
          <Card className="mb-4 p-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div>
                <div className="text-xs font-medium text-slate-500">Version</div>
                <div className="mt-1 text-sm text-slate-900">{data.schedule.version}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Installments</div>
                <div className="mt-1 text-sm text-slate-900">{data.installments.length}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Outstanding Balance</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {formatCurrency(
                    data.installments.reduce((sum, i) => sum + (Number(i.totalAmount) - Number(i.paidTotal)), 0),
                    2,
                  )}
                </div>
              </div>
              {data.schedule.remarks && (
                <div className="col-span-2">
                  <div className="text-xs font-medium text-slate-500">Remarks</div>
                  <div className="mt-1 text-sm text-slate-700">{data.schedule.remarks}</div>
                </div>
              )}
            </div>
          </Card>

          {data.installments.length === 0 ? (
            <EmptyState message="This schedule has no installments." />
          ) : (
            <Table columns={COLUMNS} rows={data.installments} rowKey={(row) => row.id} />
          )}
        </>
      )}
    </div>
  );
}
