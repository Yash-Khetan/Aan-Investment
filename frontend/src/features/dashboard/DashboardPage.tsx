import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Card, StatCard } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { LoadingState, ErrorState } from "../../components/ui/States";
import { formatCurrency, formatNumber } from "../../lib/format";
import { getDashboardSummary } from "./api";

export function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });

  return (
    <div>
      <PageHeader title="Dashboard" description="Read-only portfolio and collections overview." />

      {isLoading && <LoadingState label="Loading dashboard..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load dashboard."} />}

      {data && (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Portfolio</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total Loans" value={formatNumber(data.portfolio.totals.totalLoans)} />
              <StatCard label="Total Sanctioned" value={formatCurrency(data.portfolio.totals.totalSanctioned)} />
              <StatCard label="Total Disbursed" value={formatCurrency(data.portfolio.totals.totalDisbursed)} />
              <StatCard label="Outstanding" value={formatCurrency(data.portfolio.totals.totalOutstanding)} />
            </div>

            <Card className="mt-4 p-4">
              <div className="mb-3 text-sm font-medium text-slate-600">By Status</div>
              <div className="flex flex-col gap-2">
                {data.portfolio.byStatus.map((row) => {
                  const pct =
                    data.portfolio.totals.totalLoans > 0
                      ? Math.round((row.loanCount / data.portfolio.totals.totalLoans) * 100)
                      : 0;
                  return (
                    <div key={row.status} className="flex items-center gap-3">
                      <div className="w-32 shrink-0">
                        <Badge status={row.status} />
                      </div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-slate-700" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-16 shrink-0 text-right text-xs text-slate-500">{row.loanCount} loans</div>
                      <div className="w-32 shrink-0 text-right text-xs text-slate-500">
                        {formatCurrency(row.outstandingPrincipal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Collections</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
              <div className="mb-3 text-sm font-medium text-slate-600">Cases by Status</div>
              <div className="flex flex-wrap gap-3">
                {data.collections.byStatus.map((row) => (
                  <div key={row.status} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
                    <Badge status={row.status} />
                    <span className="text-xs text-slate-500">
                      {row.caseCount} case{row.caseCount === 1 ? "" : "s"} · {formatCurrency(row.overdueAmount)}
                    </span>
                  </div>
                ))}
                {data.collections.byStatus.length === 0 && (
                  <span className="text-sm text-slate-400">No open collection cases.</span>
                )}
              </div>
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
