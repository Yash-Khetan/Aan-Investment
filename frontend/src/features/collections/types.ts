export const ACTIVITY_TYPES = [
  "CALL",
  "REMINDER_SENT",
  "BRANCH_VISIT",
  "PROMISE_TO_PAY_CREATED",
  "PROMISE_FULFILLED",
  "PROMISE_BROKEN",
  "RECOVERY_VISIT",
  "LEGAL_NOTICE",
  "SETTLEMENT_DISCUSSION",
  "OTHER",
] as const;

export const COLLECTION_STATUSES = ["OPEN", "PROMISE_TO_PAY", "FOLLOW_UP", "CLOSED"] as const;

export interface CollectionActivityRecord {
  id: string;
  loanId: string;
  borrowerId: string;
  status: string | null;
  assignedTo: string | null;
  activityType: string;
  followUpDate: string | null;
  contactPerson: string | null;
  remarks: string | null;
  promiseDate: string | null;
  promiseAmount: string | null;
  promiseKept: boolean | null;
  createdAt: string | null;
}

export interface CreateActivityInput {
  loanId: string;
  activityType: string;
  followUpDate?: string;
  contactPerson?: string;
  remarks?: string;
  promiseDate?: string;
  promiseAmount?: number;
}
