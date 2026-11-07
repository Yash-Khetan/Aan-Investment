import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { Table, type Column } from "../../components/ui/Table";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { listUsers } from "../admin/api";
import {
  approveAllChangeRequests,
  approveChangeRequest,
  bulkApproveChangeRequests,
  bulkRejectChangeRequests,
  listPendingChangeRequests,
  rejectAllChangeRequests,
  rejectChangeRequest,
} from "./api";
import { ChangeRequestDetailModal } from "./ChangeRequestDetailModal";
import { ENTITY_TYPE_LABELS, type ChangeRequest, type ChangeRequestEntityType, type ChangeRequestStatus } from "./types";

const ENTITY_TYPE_OPTIONS: ChangeRequestEntityType[] = [
  "LOAN",
  "COLLATERAL",
  "COLLATERAL_INSURANCE",
  "LEDGER_ENTRY",
  "LEDGER_IMPORT",
];

export function ApprovalsPage() {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<ChangeRequestStatus>("PENDING");
  const [entityType, setEntityType] = useState<ChangeRequestEntityType | "">("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<ChangeRequest | null>(null);

  const filters = { status, entityType: entityType || undefined };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["change-requests", filters],
    queryFn: () => listPendingChangeRequests(filters),
  });

  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: listUsers });
  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users ?? []) map.set(u.id, `${u.firstName} ${u.lastName ?? ""}`.trim());
    return map;
  }, [users]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["change-requests"] });

  const approveOne = useMutation({
    mutationFn: (id: string) => approveChangeRequest(id),
    onSuccess: invalidate,
  });
  const rejectOne = useMutation({
    mutationFn: (id: string) => rejectChangeRequest(id),
    onSuccess: invalidate,
  });
  const bulkApprove = useMutation({
    mutationFn: (ids: string[]) => bulkApproveChangeRequests(ids),
    onSuccess: () => {
      setSelectedIds(new Set());
      invalidate();
    },
  });
  const bulkReject = useMutation({
    mutationFn: (ids: string[]) => bulkRejectChangeRequests(ids),
    onSuccess: () => {
      setSelectedIds(new Set());
      invalidate();
    },
  });
  const approveAll = useMutation({
    mutationFn: () => approveAllChangeRequests({ entityType: entityType || undefined }),
    onSuccess: invalidate,
  });
  const rejectAll = useMutation({
    mutationFn: () => rejectAllChangeRequests({ entityType: entityType || undefined }),
    onSuccess: invalidate,
  });

  const rows = data ?? [];
  const busy =
    approveOne.isPending ||
    rejectOne.isPending ||
    bulkApprove.isPending ||
    bulkReject.isPending ||
    approveAll.isPending ||
    rejectAll.isPending;

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  const columns: Column<ChangeRequest>[] = [
    {
      key: "select",
      header: "",
      render: (r) => (
        <input
          type="checkbox"
          checked={selectedIds.has(r.id)}
          onChange={() => toggleOne(r.id)}
          aria-label={`Select change request ${r.id}`}
        />
      ),
    },
    { key: "entityType", header: "Entity", render: (r) => ENTITY_TYPE_LABELS[r.entityType] },
    { key: "action", header: "Action", render: (r) => r.action },
    {
      key: "loanId",
      header: "Loan",
      render: (r) => (r.loanId ? <Link to={`/loans/${r.loanId}`} className="text-accent hover:underline">View loan</Link> : "—"),
    },
    {
      key: "requestedBy",
      header: "Requested by",
      render: (r) => (r.requestedBy ? userNameById.get(r.requestedBy) ?? r.requestedBy : "—"),
    },
    {
      key: "requestedAt",
      header: "Requested at",
      render: (r) => new Date(r.requestedAt).toLocaleString(),
    },
    { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setViewing(r)}>
            Details
          </Button>
          {r.status === "PENDING" && (
            <>
              <Button variant="secondary" disabled={busy} onClick={() => approveOne.mutate(r.id)}>
                Approve
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => rejectOne.mutate(r.id)}>
                Reject
              </Button>
            </>
          )}
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div>
      <PageHeader title="Approvals" description="Money-related changes employees have submitted, pending your review." />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ChangeRequestStatus)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as ChangeRequestEntityType | "")}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
          >
            <option value="">All entities</option>
            {ENTITY_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {ENTITY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>

          {status === "PENDING" && rows.length > 0 && (
            <div className="ml-auto flex flex-wrap gap-2">
              {selectedIds.size > 0 && (
                <>
                  <Button variant="secondary" disabled={busy} onClick={() => bulkApprove.mutate(Array.from(selectedIds))}>
                    Approve selected ({selectedIds.size})
                  </Button>
                  <Button variant="danger" disabled={busy} onClick={() => bulkReject.mutate(Array.from(selectedIds))}>
                    Reject selected ({selectedIds.size})
                  </Button>
                </>
              )}
              <Button variant="secondary" disabled={busy} onClick={() => approveAll.mutate()}>
                Approve all
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => rejectAll.mutate()}>
                Reject all
              </Button>
            </div>
          )}
        </div>
      </Card>

      {isLoading && <LoadingState label="Loading change requests..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load change requests."} />}
      {!isLoading && rows.length === 0 && <EmptyState message="Nothing here." />}

      {!isLoading && rows.length > 0 && (
        <>
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={selectedIds.size === rows.length} onChange={toggleAll} aria-label="Select all" />
            Select all on this page
          </div>
          <Table columns={columns} rows={rows} rowKey={(r) => r.id} />
        </>
      )}

      {viewing && <ChangeRequestDetailModal changeRequest={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
