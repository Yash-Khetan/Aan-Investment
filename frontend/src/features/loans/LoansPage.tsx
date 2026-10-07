import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Table, type Column } from "../../components/ui/Table";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatCurrency } from "../../lib/format";
import { FIGURE } from "../../lib/glossary";
import { listLoans } from "./api";
import type { Loan } from "./types";

/** Enough to show the whole book on one page; the totals row adds up exactly what is listed. */
const PAGE_SIZE = 100;

const sum = (rows: Loan[], pick: (l: Loan) => number) => rows.reduce((acc, l) => acc + pick(l), 0);

/**
 * Every loan with the figures people look up most, one row each, totals at
 * the bottom. Click a row to open the loan.
 */
export function LoansPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["loans", { search, limit: PAGE_SIZE }],
    queryFn: () => listLoans({ search: search || undefined, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];

  const columns: Column<Loan>[] = [
    {
      key: "loan",
      header: "Loan",
      render: (l) => (
        <div>
          <div className="font-semibold text-slate-900">{l.loanAccountNumber}</div>
          <div className="text-xs text-slate-500">{l.borrowerName ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "principal",
      header: FIGURE.principalOutstanding,
      align: "right",
      render: (l) => formatCurrency(l.snapshot.principalOutstanding),
      total: formatCurrency(sum(rows, (l) => l.snapshot.principalOutstanding)),
    },
    {
      key: "interest",
      header: FIGURE.interestDue,
      align: "right",
      render: (l) => formatCurrency(l.snapshot.interestOutstanding),
      total: formatCurrency(sum(rows, (l) => l.snapshot.interestOutstanding)),
    },
    {
      key: "payable",
      header: FIGURE.totalPayable,
      align: "right",
      render: (l) => <span className="font-semibold">{formatCurrency(l.snapshot.totalPayable)}</span>,
      total: formatCurrency(sum(rows, (l) => l.snapshot.totalPayable)),
    },
    {
      key: "overdue",
      header: FIGURE.overdue,
      align: "right",
      render: (l) =>
        l.amountOverdue > 0 ? (
          <span className="font-semibold text-dr">{formatCurrency(l.amountOverdue)}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
      total: formatCurrency(sum(rows, (l) => l.amountOverdue)),
    },
    {
      key: "dpd",
      header: FIGURE.dpd,
      align: "right",
      render: (l) => (l.dpd > 0 ? <span className="font-semibold text-dr">{l.dpd}</span> : <span className="text-slate-400">0</span>),
    },
    { key: "classification", header: FIGURE.classification, render: (l) => <Badge status={l.classification} /> },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      render: (l) => `${Number(l.interestRate).toFixed(2)}%`,
    },
    { key: "status", header: "Status", render: (l) => <Badge status={l.status} /> },
  ];

  const shown = rows.length;
  const total = data?.meta.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Loans"
        description={data ? `${total} loan${total === 1 ? "" : "s"}${shown < total ? `, first ${shown} shown` : ""}` : undefined}
        actions={
          <Link to="/loans/new">
            <Button>New loan</Button>
          </Link>
        }
      />

      <div className="mb-4 w-full sm:w-96">
        <label htmlFor="loan-search" className="sr-only">
          Search loans
        </label>
        <input
          id="loan-search"
          type="search"
          placeholder="Search by loan number or purpose"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      {isLoading && <LoadingState label="Loading loans..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Could not load loans."} />}
      {data && rows.length === 0 && (
        <EmptyState message={search ? "No loan matches that search." : "No loans yet. Create the first one with New loan."} />
      )}

      {rows.length > 0 && (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(l) => l.id}
          onRowClick={(l) => navigate(`/loans/${l.id}`)}
          totalLabel={shown === 1 ? "Total" : `Total of ${shown}`}
        />
      )}
    </div>
  );
}
