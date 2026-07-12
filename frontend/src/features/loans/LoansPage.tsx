import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Table, type Column } from "../../components/ui/Table";
import { TextField } from "../../components/ui/Field";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatCurrency, formatDate } from "../../lib/format";
import { deleteLoan, listLoans } from "./api";
import type { Loan } from "./types";

export function LoansPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["loans", search],
    queryFn: () => listLoans({ search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLoan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["loans"] }),
  });

  function handleDelete(l: Loan) {
    if (window.confirm(`Delete loan "${l.loanAccountNumber}"? This cannot be undone from the UI.`)) {
      deleteMutation.mutate(l.id);
    }
  }

  const columns: Column<Loan>[] = [
    { key: "loanAccountNumber", header: "Loan A/C No.", render: (l) => l.loanAccountNumber },
    { key: "loanType", header: "Type", render: (l) => l.loanType },
    { key: "repaymentType", header: "Repayment", render: (l) => l.repaymentType.replace(/_/g, " ") },
    { key: "sanctionedAmount", header: "Sanctioned", render: (l) => formatCurrency(l.sanctionedAmount) },
    { key: "outstandingPrincipal", header: "Outstanding", render: (l) => formatCurrency(l.outstandingPrincipal) },
    { key: "interestRate", header: "Rate", render: (l) => `${l.interestRate}%` },
    { key: "status", header: "Status", render: (l) => <Badge status={l.status} /> },
    { key: "maturityDate", header: "Maturity", render: (l) => formatDate(l.maturityDate) },
    {
      key: "actions",
      header: "",
      render: (l) => (
        <div className="flex justify-end gap-2">
          <Link to={`/loans/${l.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
          <Button variant="danger" onClick={() => handleDelete(l)} disabled={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div>
      <PageHeader title="Loans" description="Loan master data — sanction, disbursement, and lifecycle status." />

      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="w-80">
          <TextField
            label="Search"
            placeholder="Loan account number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link to="/loans/new">
          <Button>+ New Loan</Button>
        </Link>
      </div>

      {isLoading && <LoadingState label="Loading loans..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load loans."} />}
      {deleteMutation.isError && (
        <div className="mb-4">
          <ErrorState message={deleteMutation.error instanceof Error ? deleteMutation.error.message : "Failed to delete loan."} />
        </div>
      )}
      {data && data.data.length === 0 && <EmptyState message="No loans yet — create the first one." />}

      {data && data.data.length > 0 && <Table columns={columns} rows={data.data} rowKey={(l) => l.id} />}
    </div>
  );
}
