import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { Table, type Column } from "../../components/ui/Table";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { listMyChangeRequests } from "./api";
import { ENTITY_TYPE_LABELS, type ChangeRequest, type ChangeRequestStatus } from "./types";
import { ChangeRequestDetailModal } from "./ChangeRequestDetailModal";

/**
 * An employee's own submitted changes and their review status. Read-only —
 * only an admin, on the Approvals page, can approve or reject.
 */
export function MyApprovalsPage() {
  const [status, setStatus] = useState<ChangeRequestStatus | "">("");
  const [viewing, setViewing] = useState<ChangeRequest | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["my-change-requests", status],
    queryFn: () => listMyChangeRequests({ status: status || undefined }),
  });

  const rows = data ?? [];

  const columns: Column<ChangeRequest>[] = [
    { key: "entityType", header: "Entity", render: (r) => ENTITY_TYPE_LABELS[r.entityType] },
    { key: "action", header: "Action", render: (r) => r.action },
    {
      key: "loanId",
      header: "Loan",
      render: (r) => (r.loanId ? <Link to={`/loans/${r.loanId}`} className="text-accent hover:underline">View loan</Link> : "—"),
    },
    { key: "requestedAt", header: "Requested at", render: (r) => new Date(r.requestedAt).toLocaleString() },
    { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <Button variant="ghost" onClick={() => setViewing(r)}>
          Details
        </Button>
      ),
      className: "text-right",
    },
  ];

  return (
    <div>
      <PageHeader title="My Approvals" description="Money-related changes you submitted, and their review status." />

      <Card className="mb-4 p-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ChangeRequestStatus | "")}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
        >
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </Card>

      {isLoading && <LoadingState label="Loading your requests..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load your requests."} />}
      {!isLoading && rows.length === 0 && <EmptyState message="Nothing here yet." />}
      {!isLoading && rows.length > 0 && <Table columns={columns} rows={rows} rowKey={(r) => r.id} />}

      {viewing && <ChangeRequestDetailModal changeRequest={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
