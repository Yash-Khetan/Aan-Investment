import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LoadingState, EmptyState } from "../../components/ui/States";
import { Table, type Column } from "../../components/ui/Table";
import { SendNotificationModal } from "./SendNotificationModal";
import { getNotifications, getNotificationStats, triggerScheduledSweep } from "./api";
import type { NotificationLogItem } from "./types";

export function NotificationsPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [triggerFilter, setTriggerFilter] = useState<string>("");
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sweepResult, setSweepResult] = useState<any | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<NotificationLogItem | null>(null);

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ["admin", "notification-stats"],
    queryFn: getNotificationStats,
    refetchInterval: 30000, // Poll every 30s
  });

  // Notifications log query
  const { data: listData, isLoading } = useQuery({
    queryKey: ["admin", "notifications", page, channelFilter, statusFilter, triggerFilter],
    queryFn: () =>
      getNotifications({
        page,
        limit: 15,
        channel: channelFilter || undefined,
        status: statusFilter || undefined,
        triggerType: triggerFilter || undefined,
      }),
    refetchInterval: 30000,
  });

  // Sweep mutation
  const sweepMutation = useMutation({
    mutationFn: triggerScheduledSweep,
    onSuccess: (data) => {
      setSweepResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "notification-stats"] });
    },
  });

  const columns: Column<NotificationLogItem>[] = [
    {
      key: "createdAt",
      header: "Date & Time",
      render: (item) => (
        <span className="text-xs text-slate-600 font-mono">
          {new Date(item.createdAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "channel",
      header: "Channel",
      render: (item) => (
        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
            item.channel === "WHATSAPP"
              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
              : item.channel === "EMAIL"
              ? "bg-blue-100 text-blue-800 border border-blue-200"
              : "bg-slate-100 text-slate-800"
          }`}
        >
          {item.channel === "WHATSAPP" ? "💬 WhatsApp" : "✉️ Email"}
        </span>
      ),
    },
    {
      key: "recipient",
      header: "Recipient / Borrower",
      render: (item) => (
        <div>
          <div className="font-medium text-slate-900 text-sm">
            {item.borrowerName || "Direct Contact"}
          </div>
          <div className="text-xs text-slate-500 font-mono">{item.recipient || "—"}</div>
        </div>
      ),
    },
    {
      key: "loanAccountNumber",
      header: "Loan Account",
      render: (item) => (
        <span className="text-xs font-mono font-medium text-slate-700">
          {item.loanAccountNumber ? `#${item.loanAccountNumber}` : "—"}
        </span>
      ),
    },
    {
      key: "triggerType",
      header: "Trigger",
      render: (item) => {
        const triggerMap: Record<string, { label: string; color: string }> = {
          SCHEDULED_EMI: { label: "EMI Reminder", color: "bg-amber-100 text-amber-800" },
          SCHEDULED_OVERDUE: { label: "Overdue Notice", color: "bg-rose-100 text-rose-800" },
          PAYMENT_RECEIPT: { label: "Payment Receipt", color: "bg-teal-100 text-teal-800" },
          DISBURSEMENT: { label: "Disbursement", color: "bg-indigo-100 text-indigo-800" },
          MANUAL: { label: "Admin Manual", color: "bg-slate-100 text-slate-700" },
          AUTH: { label: "Auth / System", color: "bg-purple-100 text-purple-700" },
        };
        const t = triggerMap[item.triggerType || ""] || {
          label: item.triggerType || "General",
          color: "bg-slate-100 text-slate-700",
        };
        return <span className={`rounded px-2 py-0.5 text-xs font-medium ${t.color}`}>{t.label}</span>;
      },
    },
    {
      key: "title",
      header: "Subject / Summary",
      render: (item) => (
        <div className="max-w-xs">
          <div className="truncate font-medium text-slate-800 text-sm" title={item.title}>
            {item.title}
          </div>
          {item.message && (
            <div className="truncate text-xs text-slate-500" title={item.message}>
              {item.message}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
            item.status === "SUCCESS"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-rose-100 text-rose-800"
          }`}
        >
          {item.status === "SUCCESS" ? "✓ Sent" : "✗ Failed"}
        </span>
      ),
    },
    {
      key: "id",
      header: "Action",
      render: (item) => (
        <button
          onClick={() => setSelectedMessage(item)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          View
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Notifications Hub"
          description="Manage external customer communications across WhatsApp and Email, view delivery history, and control automated reminder schedules."
        />
        <div className="flex gap-2">
          <Button
            onClick={() => sweepMutation.mutate()}
            disabled={sweepMutation.isPending}
            variant="ghost"
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
          >
            {sweepMutation.isPending ? "Running Sweep..." : "⚡ Run Scheduled Sweep"}
          </Button>
          <Button
            onClick={() => setIsSendModalOpen(true)}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            + Send Notification
          </Button>
        </div>
      </div>

      {/* Sweep Result Banner */}
      {sweepResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
              <span>✓</span> Scheduled Sweep Completed Successfully
            </div>
            <button
              onClick={() => setSweepResult(null)}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4 text-xs text-emerald-800 sm:grid-cols-4">
            <div>Active Loans Checked: <strong>{sweepResult.totalActiveLoans}</strong></div>
            <div>EMI Reminders Sent: <strong>{sweepResult.emiRemindersSent}</strong></div>
            <div>Overdue Notices Sent: <strong>{sweepResult.overdueNoticesSent}</strong></div>
            <div>Already Sent Today: <strong>{sweepResult.skippedAlreadySent}</strong></div>
          </div>
          {sweepResult.errors && sweepResult.errors.length > 0 && (
            <div className="mt-2 rounded bg-rose-50 p-2 text-xs text-rose-800 border border-rose-200">
              <strong>Errors encountered:</strong>
              <ul className="list-disc pl-4 mt-1">
                {sweepResult.errors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Sent</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{stats?.total ?? "—"}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Lifetime dispatches</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sent Today</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{stats?.sentToday ?? "—"}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Dispatches since 00:00</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">WhatsApp Messages</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{stats?.whatsapp ?? "—"}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Twilio WhatsApp API</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Emails Sent</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{stats?.email ?? "—"}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">SMTP / Nodemailer</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Success Rate</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{stats?.successRate ?? 100}%</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Delivery reliability</div>
        </Card>
      </div>

      {/* Automated Schedules Card */}
      <Card className="p-4 bg-slate-900 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">Automated Notification Schedules</span>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
                ● Live & Deduplicated
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              External customer notifications run on automated daily sweeps with idempotency locks.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="rounded-lg bg-white/10 px-3 py-2 border border-white/10">
              <span className="text-slate-400">09:30 AM IST</span>
              <div className="font-semibold text-white">EMI Due Reminders (T-3, T-0)</div>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-2 border border-white/10">
              <span className="text-slate-400">10:00 AM IST</span>
              <div className="font-semibold text-white">Overdue & Penal Notices (DPD &gt; 0)</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Filters:</div>

          {/* Channel Filter */}
          <select
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
          >
            <option value="">All Channels</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">Email</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">Sent (Success)</option>
            <option value="FAILED">Failed</option>
          </select>

          {/* Trigger Filter */}
          <select
            value={triggerFilter}
            onChange={(e) => {
              setTriggerFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
          >
            <option value="">All Triggers</option>
            <option value="SCHEDULED_EMI">Scheduled EMI Reminders</option>
            <option value="SCHEDULED_OVERDUE">Scheduled Overdue Notices</option>
            <option value="PAYMENT_RECEIPT">Payment Receipts</option>
            <option value="DISBURSEMENT">Disbursements</option>
            <option value="MANUAL">Admin Manual</option>
          </select>

          {(channelFilter || statusFilter || triggerFilter) && (
            <button
              onClick={() => {
                setChannelFilter("");
                setStatusFilter("");
                setTriggerFilter("");
                setPage(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 underline ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="overflow-hidden">
        {isLoading && (
          <div className="p-8">
            <LoadingState label="Loading notification history..." />
          </div>
        )}

        {!isLoading && (!listData?.items || listData.items.length === 0) && (
          <div className="p-8">
            <EmptyState message="No notification dispatches found matching your filters." />
          </div>
        )}

        {!isLoading && listData?.items && listData.items.length > 0 && (
          <Table<NotificationLogItem>
            columns={columns}
            rows={listData.items}
            rowKey={(item) => item.id}
            onRowClick={(item) => setSelectedMessage(item)}
          />
        )}

        {/* Pagination */}
        {listData && listData.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div>
              Showing page <strong>{listData.pagination.page}</strong> of{" "}
              <strong>{listData.pagination.totalPages}</strong> ({listData.pagination.total} total rows)
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                disabled={page >= listData.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">{selectedMessage.title}</h3>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>Channel: <strong className="text-slate-900">{selectedMessage.channel}</strong></div>
                <div>Status: <strong className="text-slate-900">{selectedMessage.status}</strong></div>
                <div>Recipient: <strong className="text-slate-900">{selectedMessage.recipient || "—"}</strong></div>
                <div>Trigger: <strong className="text-slate-900">{selectedMessage.triggerType || "—"}</strong></div>
                <div>Sent At: <strong className="text-slate-900">{new Date(selectedMessage.createdAt).toLocaleString()}</strong></div>
                <div>Loan Account: <strong className="text-slate-900">{selectedMessage.loanAccountNumber ? `#${selectedMessage.loanAccountNumber}` : "—"}</strong></div>
              </div>
              <div>
                <div className="font-semibold text-slate-700 mb-1">Message Content:</div>
                <div className="rounded-lg bg-slate-100 p-3 text-slate-800 whitespace-pre-wrap font-sans border border-slate-200 text-xs">
                  {selectedMessage.message || "(No message body saved)"}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setSelectedMessage(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Send Modal */}
      <SendNotificationModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
      />
    </div>
  );
}
