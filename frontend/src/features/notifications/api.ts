import { apiRequest } from "../../lib/api";
import type {
  NotificationListResponse,
  NotificationStats,
  SendNotificationPayload,
  SweepResult,
  NotificationLogItem,
} from "./types";

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: { message: string };
}

export async function getNotifications(params: {
  page?: number;
  limit?: number;
  channel?: string;
  status?: string;
  triggerType?: string;
  borrowerId?: string;
  loanId?: string;
} = {}): Promise<NotificationListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.channel) query.set("channel", params.channel);
  if (params.status) query.set("status", params.status);
  if (params.triggerType) query.set("triggerType", params.triggerType);
  if (params.borrowerId) query.set("borrowerId", params.borrowerId);
  if (params.loanId) query.set("loanId", params.loanId);

  const qs = query.toString();
  const url = `/admin/notifications${qs ? `?${qs}` : ""}`;
  const res = await apiRequest<Envelope<NotificationListResponse>>(url);
  return res.data;
}

export async function getNotificationStats(): Promise<NotificationStats> {
  const res = await apiRequest<Envelope<NotificationStats>>("/admin/notifications/stats");
  return res.data;
}

export async function sendManualNotification(payload: SendNotificationPayload): Promise<{ message: string }> {
  const res = await apiRequest<Envelope<{ message: string }>>("/admin/notifications/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function triggerScheduledSweep(): Promise<SweepResult> {
  const res = await apiRequest<Envelope<SweepResult>>("/admin/notifications/trigger-sweep", {
    method: "POST",
  });
  return res.data;
}

export async function getBorrowerRecentNotification(borrowerId: string): Promise<NotificationLogItem | null> {
  const res = await apiRequest<Envelope<{ recent: NotificationLogItem | null }>>(
    `/admin/notifications/borrower-recent/${borrowerId}`
  );
  return res.data.recent;
}
