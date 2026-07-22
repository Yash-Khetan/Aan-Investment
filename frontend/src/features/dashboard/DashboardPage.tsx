import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Card, StatCard } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LoadingState, ErrorState } from "../../components/ui/States";
import { HorizontalBarChart, type BarDatum } from "../../components/charts/HorizontalBarChart";
import { Meter } from "../../components/charts/Meter";
import { StatusLegend } from "../../components/charts/StatusLegend";
import { LOAN_STATUS_ROLE, COLLECTION_STATUS_ROLE } from "../../components/charts/palette";
import { formatCurrency, formatNumber, formatPercent } from "../../lib/format";
import { getDashboardSummary } from "./api";

const AT_RISK_STATUSES = new Set(["OVERDUE", "NPA", "WRITTEN_OFF"]);

export function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });

  const portfolioBars: BarDatum[] =
    data?.portfolio.byStatus.map((row) => ({
      key: row.status,
      label: row.status.replace(/_/g, " "),
      value: row.outstandingPrincipal,
      displayValue: formatCurrency(row.outstandingPrincipal),
      detail: `${row.loanCount} loan${row.loanCount === 1 ? "" : "s"}`,
      role: LOAN_STATUS_ROLE[row.status] ?? "warning",
    })) ?? [];

  const collectionsBars: BarDatum[] =
    data?.collections.byStatus.map((row) => ({
      key: row.status,
      label: row.status.replace(/_/g, " "),
      value: row.overdueAmount,
      displayValue: formatCurrency(row.overdueAmount),
      detail: `${row.caseCount} case${row.caseCount === 1 ? "" : "s"}`,
      role: COLLECTION_STATUS_ROLE[row.status] ?? "warning",
    })) ?? [];

  const atRiskOutstanding =
    data?.portfolio.byStatus
      .filter((row) => AT_RISK_STATUSES.has(row.status))
      .reduce((sum, row) => sum + row.outstandingPrincipal, 0) ?? 0;

  const atRiskPct =
    data && data.portfolio.totals.totalOutstanding > 0
      ? (atRiskOutstanding / data.portfolio.totals.totalOutstanding) * 100
      : 0;

  return (
    <div>
      <PageHeader title="Dashboard" description="Portfolio and collections overview." />

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

      {data && (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Portfolio</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Loans" value={formatNumber(data.portfolio.totals.totalLoans)} />
              <StatCard label="Total Sanctioned" value={formatCurrency(data.portfolio.totals.totalSanctioned)} />
              <StatCard label="Total Disbursed" value={formatCurrency(data.portfolio.totals.totalDisbursed)} />
              <StatCard label="Outstanding" value={formatCurrency(data.portfolio.totals.totalOutstanding)} />
              <StatCard label="Overall IRR" value={formatPercent(data.returns.overallIrr)} />
              <StatCard label="Overall MIRR" value={formatPercent(data.returns.overallMirr)} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-4 lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-600">Outstanding by Status</div>
                  <StatusLegend roles={["good", "warning", "critical"]} />
                </div>
                <HorizontalBarChart data={portfolioBars} />
              </Card>

              <Card className="flex flex-col justify-center gap-4 p-4">
                <Meter
                  label="Portfolio at Risk"
                  pct={atRiskPct}
                  sub={`${formatCurrency(atRiskOutstanding)} across Overdue, NPA & Written-Off loans`}
                />
                <Meter
                  label="Overdue Installments"
                  pct={
                    data.portfolio.totals.totalLoans > 0
                      ? (data.collections.overdueInstallments.count / data.portfolio.totals.totalLoans) * 100
                      : 0
                  }
                  sub={`${formatNumber(data.collections.overdueInstallments.count)} installments · ${formatCurrency(data.collections.overdueInstallments.totalAmount)}`}
                />
              </Card>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Collections</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Open Cases" value={formatNumber(data.collections.openCases)} />
              <StatCard label="Total Overdue" value={formatCurrency(data.collections.totalOverdueAmount)} />
              <StatCard label="Upcoming Follow-ups" value={formatNumber(data.collections.upcomingFollowUps)} />
              <StatCard
                label="Overdue Installments"
                value={formatNumber(data.collections.overdueInstallments.count)}
                sub={formatCurrency(data.collections.overdueInstallments.totalAmount)}
              />
            </div>

            <Card className="mt-4 p-4">
              <div className="mb-3 text-sm font-medium text-slate-600">Overdue Amount by Case Status</div>
              {collectionsBars.length > 0 ? (
                <HorizontalBarChart data={collectionsBars} />
              ) : (
                <span className="text-sm text-slate-400">No open collection cases.</span>
              )}
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
