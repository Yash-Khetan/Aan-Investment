export type NotificationChannel = "EMAIL" | "SMS" | "WHATSAPP";
export type NotificationStatus = "SUCCESS" | "FAILED";
export type NotificationTriggerType =
  | "SCHEDULED_EMI"
  | "SCHEDULED_OVERDUE"
  | "DISBURSEMENT"
  | "PAYMENT_RECEIPT"
  | "MANUAL"
  | "AUTH";

export interface NotificationLogItem {
  id: string;
  title: string;
  message: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  triggerType: NotificationTriggerType | null;
  recipient: string | null;
  createdAt: string;
  borrowerId: string | null;
  borrowerName: string | null;
  borrowerPhone: string | null;
  borrowerEmail: string | null;
  loanId: string | null;
  loanAccountNumber: string | null;
}

export interface NotificationStats {
  total: number;
  success: number;
  failed: number;
  email: number;
  whatsapp: number;
  sentToday: number;
  successRate: number;
}

export interface NotificationListResponse {
  items: NotificationLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SendNotificationPayload {
  borrowerId?: string;
  loanId?: string;
  channel: "WHATSAPP" | "EMAIL";
  recipient: string;
  title?: string;
  subject?: string;
  message: string;
}

export interface SweepResult {
  success: boolean;
  totalActiveLoans: number;
  emiRemindersSent: number;
  overdueNoticesSent: number;
  skippedAlreadySent: number;
  errors: string[];
}
