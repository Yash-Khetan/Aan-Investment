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
