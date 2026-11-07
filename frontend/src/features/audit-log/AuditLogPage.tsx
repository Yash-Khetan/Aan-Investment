import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Table, type Column } from "../../components/ui/Table";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { listUsers } from "../admin/api";
import { listAuditLogs } from "./api";
import type { AuditLog } from "./types";

const ENTITY_TYPE_OPTIONS = [
  "LOAN",
  "COLLATERAL",
  "COLLATERAL_INSURANCE",
  "BORROWER",
  "PROMOTER",
  "GUARANTOR",
  "DOCUMENT",
  "LEDGER_ENTRY",
  "LEDGER_IMPORT",
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * The trail of every change any employee has made — admin-only, per the
 * requirement that this visibility belongs to the admin alone.
 */
export function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const [userId, setUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<AuditLog | null>(null);

  const filters = {
    entityType: entityType || undefined,
    userId: userId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    limit: 50,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => listAuditLogs(filters),
  });

  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: listUsers });
  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users ?? []) map.set(u.id, `${u.firstName} ${u.lastName ?? ""}`.trim());
    return map;
  }, [users]);

  const rows = data ?? [];

  const columns: Column<AuditLog>[] = [
    { key: "createdAt", header: "When", render: (r) => new Date(r.createdAt).toLocaleString() },
    { key: "userId", header: "Who", render: (r) => (r.userId ? userNameById.get(r.userId) ?? r.userId : "System") },
    { key: "action", header: "Action", render: (r) => r.action },
    { key: "entityType", header: "Entity", render: (r) => r.entityType },
    { key: "entityId", header: "Record", render: (r) => <span className="font-mono text-xs">{r.entityId.slice(0, 8)}</span> },
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

  function clearFilters() {
    setEntityType("");
    setUserId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div>
      <PageHeader title="Audit Log" description="Every change any employee has made, for your eyes only." />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
          >
            <option value="">All entities</option>
            {ENTITY_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          <select
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
          >
            <option value="">All users</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {`${u.firstName} ${u.lastName ?? ""}`.trim()}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
          />

          {(entityType || userId || dateFrom || dateTo) && (
            <button onClick={clearFilters} className="ml-auto text-xs text-slate-500 underline hover:text-slate-800">
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {isLoading && <LoadingState label="Loading audit log..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load audit log."} />}
      {!isLoading && rows.length === 0 && <EmptyState message="No audit entries found." />}

      {!isLoading && rows.length > 0 && (
        <>
          <Table columns={columns} rows={rows} rowKey={(r) => r.id} />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button variant="ghost" disabled={rows.length < 50} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {viewing.action} · {viewing.entityType}
              </h3>
              <button onClick={() => setViewing(null)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto text-xs">
              {Array.from(new Set([...Object.keys(viewing.oldValues ?? {}), ...Object.keys(viewing.newValues ?? {})])).map(
                (field) => (
                  <div key={field} className="grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-2">
                    <div className="font-medium text-slate-600">{field}</div>
                    <div className="text-slate-500 line-through">{formatValue(viewing.oldValues?.[field])}</div>
                    <div className="font-medium text-slate-900">{formatValue(viewing.newValues?.[field])}</div>
                  </div>
                ),
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="secondary" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
