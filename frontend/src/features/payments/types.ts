export const PAYMENT_MODE_OPTIONS = [
  "NEFT",
  "RTGS",
  "IMPS",
  "UPI",
  "CHEQUE",
  "CASH",
  "BANK_TRANSFER",
  "OTHER",
] as const;

export type PaymentMode = (typeof PAYMENT_MODE_OPTIONS)[number];

export type PaymentStatus = "PENDING" | "PARTIAL" | "SUCCESS" | "FAILED" | "CANCELLED";

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  installmentId: string | null;
  principalApplied: string;
  interestApplied: string;
  penalInterestApplied: string;
  otherCharges: string;
}

export interface Payment {
  id: string;
  paymentRefNumber: string;
  loanId: string;
  amount: string;
  paymentDate: string;
  valueDate: string | null;
  paymentMode: PaymentMode;
  status: PaymentStatus;
  transactionRef: string | null;
  receivedBy: string | null;
  remarks: string | null;
  createdAt: string;
}

/** Shape returned by GET /payments/:loanId — one row per payment, with all of its allocations attached (more than one when overflow was cascaded forward). */
export interface PaymentWithAllocations extends Payment {
  allocations: PaymentAllocation[];
}

export interface WaterfallResult {
  penaltyApplied: number;
  interestApplied: number;
  principalApplied: number;
  unallocated: number;
}

export interface RecordPaymentInput {
  loanId: string;
  paymentRefNumber: string;
  amount: number;
  paymentDate: string;
  paymentMode: PaymentMode;
  transactionRef?: string;
  receivedBy?: string;
  remarks?: string;
  installmentId?: string;
  outstandingPenalty: number;
  outstandingInterest: number;
  outstandingPrincipal: number;
  /** Confirmed by the user: apply any amount left over (after fully settling the selected installment) forward into the loan's next due installment(s). */
  autoApplyOverflow?: boolean;
}

export interface InstallmentSettled {
  installmentId: string;
  installmentNumber: number;
  principalApplied: number;
  interestApplied: number;
}

export interface RecordPaymentResult {
  payment: Payment;
  allocations: PaymentAllocation[];
  waterfallResult: WaterfallResult;
  /** Installments beyond the one originally selected that got a share of this payment via overflow cascading. */
  installmentsSettled: InstallmentSettled[];
}
