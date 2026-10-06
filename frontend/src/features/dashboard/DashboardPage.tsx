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
import { formatCurrency, formatNumber, formatPercent } from "../../lib/format";
import { getDashboardSummary } from "./api";

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
        </div>
      )}
    </div>
  );
}
