export const REPAYMENT_TYPE_OPTIONS = [
  { value: "EMI", label: "EMI" },
  { value: "BULLET", label: "Bullet Repayment" },
  { value: "INTEREST_ONLY", label: "Interest Only" },
  { value: "STRUCTURED", label: "Structured / Customized" },
] as const;

export type RepaymentType = (typeof REPAYMENT_TYPE_OPTIONS)[number]["value"];

export type InstallmentStatus = "PENDING" | "PARTIAL" | "SUCCESS" | "FAILED" | "CANCELLED";

export interface RepaymentSchedule {
  id: string;
  loanId: string;
  version: number;
  isCurrent: boolean;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Installment {
  id: string;
  scheduleId: string;
  installmentNumber: number;
  dueDate: string;
  principalAmount: string;
  interestAmount: string;
  totalAmount: string;
  paidPrincipal: string;
  paidInterest: string;
  paidTotal: string;
  status: InstallmentStatus;
  paidDate: string | null;
  penaltyPaid: string;
}

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  PENDING: "Pending",
  PARTIAL: "Partial",
  SUCCESS: "Paid",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

function isPastDue(dueDate: string): boolean {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

/**
 * Whether an installment is currently overdue. Deliberately NOT folded into a
 * combined "status" value — an installment can be both PARTIAL (some money
 * came in) and overdue (it's still short today) at the same time, and
 * collapsing that into a single "Overdue" badge hides whether it's partially
 * paid or untouched. Show the real status badge and this as a separate signal.
 */
export function isInstallmentOverdue(installment: { status: InstallmentStatus; dueDate: string }): boolean {
  const isOutstanding = installment.status === "PENDING" || installment.status === "PARTIAL";
  return isOutstanding && isPastDue(installment.dueDate);
}

function daysBetween(from: string, to: Date): number {
  const fromDate = new Date(from);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(to);
  toDate.setHours(0, 0, 0, 0);
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000);
}

/** Whole days between dueDate and today; 0 if not overdue. */
export function getDaysOverdue(dueDate: string): number {
  return Math.max(0, daysBetween(dueDate, new Date()));
}

/** Whole days between dueDate and when a specific payment was made; 0 if paid on time or early. */
export function getDaysLate(dueDate: string, paymentDate: string): number {
  return Math.max(0, daysBetween(dueDate, new Date(paymentDate)));
}

export interface ScheduleWithInstallments {
  schedule: RepaymentSchedule;
  installments: Installment[];
}

export interface GenerateScheduleInput {
  loanId: string;
  principal: number;
  annualRate: number;
  tenureMonths: number;
  moratoriumMonths?: number;
  disbursementDate: string;
  repaymentType: RepaymentType;
  remarks?: string;
}
