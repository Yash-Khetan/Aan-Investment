import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Card, StatCard } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LoadingState, ErrorState } from "../../components/ui/States";
import { HorizontalBarChart, type BarDatum } from "../../components/charts/HorizontalBarChart";
import { Meter } from "../../components/charts/Meter";
import { StatusLegend } from "../../components/charts/StatusLegend";
import { CLASSIFICATION_ROLE } from "../../components/charts/palette";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "../../lib/format";
import { getDashboardSummary } from "./api";
import type { ScheduledSummary, ScheduledWindow } from "./types";

/**
 * Portfolio overview. Every money figure is the sum of each loan's ledger
 * snapshot, so the dashboard always adds up to the Loans list.
 */
export function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });

  const totals = data?.portfolio.totals;

  const classificationBars: BarDatum[] =
    data?.portfolio.byClassification.map((row) => ({
      key: row.classification,
      label: row.classification,
      value: row.principalOutstanding,
      displayValue: formatCurrency(row.principalOutstanding),
      detail: `${row.loanCount} loan${row.loanCount === 1 ? "" : "s"}`,
      role: CLASSIFICATION_ROLE[row.classification] ?? "warning",
    })) ?? [];

  // Portfolio at Risk: principal on loans with any DPD at all (SMA-0 and worse).
  const atRiskOutstanding =
    data?.portfolio.byClassification
      .filter((row) => row.classification !== "STD")
      .reduce((sum, row) => sum + row.principalOutstanding, 0) ?? 0;

  const atRiskPct = totals && totals.totalOutstanding > 0 ? (atRiskOutstanding / totals.totalOutstanding) * 100 : 0;
  const overdueLoansPct = totals && totals.totalLoans > 0 ? (totals.loansOverdue / totals.totalLoans) * 100 : 0;

  return (
    <div>
      <PageHeader title="Dashboard" description="Portfolio overview, from every loan's ledger." />

      <div className="mb-6 flex gap-3">
        <Link to="/borrowers/new">
          <Button>+ New Borrower</Button>
        </Link>
        <Link to="/loans/new">
          <Button variant="secondary">+ New Loan</Button>
        </Link>
      </div>

      {isLoading && <LoadingState label="Loading dashboard..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load dashboard."} />}

      {data && totals && (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Portfolio</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Loans" value={formatNumber(totals.totalLoans)} />
              <StatCard label="Total Sanctioned" value={formatCurrency(totals.totalSanctioned)} />
              <StatCard label="Total Disbursed" value={formatCurrency(totals.totalDisbursed)} />
              <StatCard label="Total Received" value={formatCurrency(totals.totalReceived)} />
              <StatCard label="Principal Outstanding" value={formatCurrency(totals.totalOutstanding)} />
              <StatCard label="Interest Due" value={formatCurrency(totals.totalInterestDue)} />
              <StatCard label="Total Payable" value={formatCurrency(totals.totalPayable)} />
              <StatCard
                label="Overdue"
                value={formatCurrency(totals.totalOverdue)}
                sub={`${formatNumber(totals.loansOverdue)} loan${totals.loansOverdue === 1 ? "" : "s"} past due`}
              />
              <StatCard label="Overall IRR" value={formatPercent(data.returns.overallIrr)} />
              <StatCard label="Overall MIRR" value={formatPercent(data.returns.overallMirr)} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Asset Quality</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-4 lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-600">Principal Outstanding by Classification</div>
                  <StatusLegend roles={["good", "warning", "serious", "critical"]} />
                </div>
                <HorizontalBarChart data={classificationBars} />
              </Card>

              <Card className="flex flex-col justify-center gap-4 p-4">
                <Meter
                  label="Portfolio at Risk"
                  pct={atRiskPct}
                  sub={`${formatCurrency(atRiskOutstanding)} principal on loans past due (SMA-0 to NPA)`}
                />
                <Meter
                  label="Loans Past Due"
                  pct={overdueLoansPct}
                  sub={`${formatNumber(totals.loansOverdue)} of ${formatNumber(totals.totalLoans)} loans · ${formatCurrency(totals.totalOverdue)} overdue`}
                />
              </Card>
            </div>
          </section>

          <ScheduledSection scheduled={data.scheduled} />
        </div>
      )}
    </div>
  );
}

function WindowCard({ label, window }: { label: string; window: ScheduledWindow }) {
  return (
    <StatCard
      label={label}
      value={`${formatNumber(window.count)} entr${window.count === 1 ? "y" : "ies"}`}
      sub={`Disbursements ${formatCurrency(window.disbursements)} · Receipts ${formatCurrency(window.receipts)}`}
    />
  );
}

/**
 * Disbursements and receipts dated after today. Kept apart from every figure
 * above: none of them counts anywhere until its date arrives, when it moves
 * into the portfolio figures on its own.
 */
function ScheduledSection({ scheduled }: { scheduled: ScheduledSummary }) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Scheduled</h2>
      <p className="mb-3 text-xs text-slate-500">
        Dated after today — not included in any figure above until their date arrives.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WindowCard label="Next 7 days" window={scheduled.next7Days} />
        <WindowCard label="Next 30 days" window={scheduled.next30Days} />
        <WindowCard label="All scheduled" window={scheduled.all} />
      </div>

      {scheduled.entries.length === 0 ? (
        <Card className="mt-4 p-4 text-sm text-slate-400">Nothing scheduled.</Card>
      ) : (
        <Card className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Date", "Loan", "Borrower", "Type", "Amount", "Particulars"].map((h) => (
                  <th
                    key={h}
                    className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                      h === "Amount" ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {scheduled.entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{formatDate(e.entryDate)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900">{e.loanAccountNumber}</td>
                  <td className="px-4 py-2.5 text-slate-700">{e.borrowerName}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        e.type === "DISBURSEMENT" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {e.type === "DISBURSEMENT" ? "Disbursement" : "Receipt"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-900">
                    {formatCurrency(e.amount, 2)}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-slate-500" title={e.narration ?? ""}>
                    {e.narration || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
