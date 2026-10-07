import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Badge } from "../../components/ui/Badge";
import { MoneyStrip } from "../../components/ui/MoneyStrip";
import { Table, type Column } from "../../components/ui/Table";
import { LoadingState, ErrorState } from "../../components/ui/States";
import { HorizontalBarChart, type BarDatum } from "../../components/charts/HorizontalBarChart";
import { Meter } from "../../components/charts/Meter";
import { CLASSIFICATION_ROLE } from "../../components/charts/palette";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "../../lib/format";
import { FIGURE } from "../../lib/glossary";
import { getDashboardSummary } from "./api";
import type { NeedsAttentionLoan, ScheduledEntry, ScheduledSummary } from "./types";

function Section({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {note && <p className="text-sm text-slate-500">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * The portfolio as of today, laid out as the questions people ask of it:
 * what is out there, which loans need chasing, what money is due to move
 * next, and how healthy the book is. Every figure is summed from the loans'
 * ledgers, so it adds up to the Loans list.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });

  if (isLoading) return <LoadingState label="Loading dashboard..." />;
  if (isError || !data) {
    return <ErrorState message={error instanceof Error ? error.message : "Could not load the dashboard."} />;
  }

  const t = data.portfolio.totals;

  const attentionColumns: Column<NeedsAttentionLoan>[] = [
    {
      key: "loan",
      header: "Loan",
      render: (l) => (
        <div>
          <div className="font-semibold text-slate-900">{l.loanAccountNumber}</div>
          <div className="text-xs text-slate-500">{l.borrowerName}</div>
        </div>
      ),
    },
    {
      key: "overdue",
      header: FIGURE.overdue,
      align: "right",
      render: (l) => <span className="font-semibold text-dr">{formatCurrency(l.amountOverdue)}</span>,
      total: formatCurrency(t.totalOverdue),
    },
    { key: "dpd", header: FIGURE.dpd, align: "right", render: (l) => <span className="font-semibold">{l.dpd}</span> },
    { key: "classification", header: FIGURE.classification, render: (l) => <Badge status={l.classification} /> },
    { key: "since", header: "Unpaid since", render: (l) => formatDate(l.oldestOverdueDueDate) },
    { key: "payable", header: FIGURE.totalPayable, align: "right", render: (l) => formatCurrency(l.totalPayable) },
  ];

  const classificationBars: BarDatum[] = data.portfolio.byClassification.map((row) => ({
    key: row.classification,
    label: row.classification,
    value: row.principalOutstanding,
    displayValue: formatCurrency(row.principalOutstanding),
    detail: `${row.loanCount} loan${row.loanCount === 1 ? "" : "s"}`,
    role: CLASSIFICATION_ROLE[row.classification] ?? "warning",
  }));

  // Portfolio at risk: principal on loans with any days past due.
  const atRisk = data.portfolio.byClassification
    .filter((row) => row.classification !== "STD")
    .reduce((sum, row) => sum + row.principalOutstanding, 0);
  const atRiskPct = t.totalOutstanding > 0 ? (atRisk / t.totalOutstanding) * 100 : 0;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <PageHeader
          title="Dashboard"
          description={`${formatNumber(t.totalLoans)} loan${t.totalLoans === 1 ? "" : "s"}, figures as of today, ${formatDate(new Date())}`}
        />
        <MoneyStrip
          figures={[
            {
              label: FIGURE.disbursed,
              value: formatCurrency(t.totalDisbursed),
              note: `${FIGURE.sanctioned} ${formatCurrency(t.totalSanctioned)}`,
            },
            { label: FIGURE.received, value: formatCurrency(t.totalReceived) },
            { label: FIGURE.principalOutstanding, value: formatCurrency(t.totalOutstanding) },
            { label: FIGURE.interestDue, value: formatCurrency(t.totalInterestDue), note: "After TDS" },
            { label: FIGURE.totalPayable, value: formatCurrency(t.totalPayable) },
            {
              label: FIGURE.overdue,
              value: formatCurrency(t.totalOverdue),
              tone: t.totalOverdue > 0 ? "alert" : "muted",
              note:
                t.loansOverdue > 0 ? `${t.loansOverdue} loan${t.loansOverdue === 1 ? "" : "s"} past due` : "Nothing overdue",
            },
          ]}
        />
      </div>

      <Section title="Needs attention" note="Loans with interest past due, longest overdue first">
        {data.portfolio.needsAttention.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
            Every loan is up to date. Nothing is past due.
          </p>
        ) : (
          <Table
            columns={attentionColumns}
            rows={data.portfolio.needsAttention}
            rowKey={(l) => l.loanId}
            onRowClick={(l) => navigate(`/loans/${l.loanId}`)}
          />
        )}
      </Section>

      <ScheduledSection scheduled={data.scheduled} onOpen={(e) => navigate(`/loans/${e.loanId}?tab=ledger`)} />

      <Section title="Asset quality" note="Principal outstanding by days-past-due classification">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
            <HorizontalBarChart data={classificationBars} />
          </div>
          <div className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5">
            <Meter label="Portfolio at risk" pct={atRiskPct} sub={`${formatCurrency(atRisk)} principal on loans past due`} />
            <dl className="divide-y divide-slate-100 text-sm">
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Return to date (IRR)</dt>
                <dd className="font-semibold text-slate-900">{formatPercent(data.returns.overallIrr)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">MIRR</dt>
                <dd className="font-semibold text-slate-900">{formatPercent(data.returns.overallMirr)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Section>
    </div>
  );
}

/**
 * Disbursements and receipts dated after today. Kept apart from every figure
 * above: none counts anywhere until its date arrives, when it moves into the
 * portfolio figures on its own.
 */
function ScheduledSection({
  scheduled,
  onOpen,
}: {
  scheduled: ScheduledSummary;
  onOpen: (e: ScheduledEntry) => void;
}) {
  const columns: Column<ScheduledEntry>[] = [
    { key: "date", header: "Date", render: (e) => formatDate(e.entryDate) },
    {
      key: "loan",
      header: "Loan",
      render: (e) => (
        <div>
          <div className="font-semibold text-slate-900">{e.loanAccountNumber}</div>
          <div className="text-xs text-slate-500">{e.borrowerName}</div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (e) => (
        <span className={e.type === "DISBURSEMENT" ? "text-dr" : "text-cr"}>
          {e.type === "DISBURSEMENT" ? "Disbursement" : "Receipt"}
        </span>
      ),
    },
    { key: "amount", header: "Amount", align: "right", render: (e) => formatCurrency(e.amount, 2) },
    { key: "narration", header: "Particulars", render: (e) => <span className="text-slate-500">{e.narration || "—"}</span> },
  ];

  const figure = (label: string, win: ScheduledSummary["all"]) => ({
    label,
    value: formatNumber(win.count),
    note: `Out ${formatCurrency(win.disbursements)}, in ${formatCurrency(win.receipts)}`,
  });

  return (
    <Section title="Scheduled" note="Dated after today, not counted in any figure above yet">
      <div className="mb-4">
        <MoneyStrip
          figures={[
            figure("Next 7 days", scheduled.next7Days),
            figure("Next 30 days", scheduled.next30Days),
            figure("All scheduled", scheduled.all),
          ]}
        />
      </div>
      {scheduled.entries.length > 0 && (
        <Table columns={columns} rows={scheduled.entries} rowKey={(e) => e.id} onRowClick={onOpen} />
      )}
    </Section>
  );
}
