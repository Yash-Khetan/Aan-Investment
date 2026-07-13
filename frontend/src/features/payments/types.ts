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

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  installmentId: string | null;
  principalApplied: string;
  interestApplied: string;
  penalInterestApplied: string;
  otherCharges: string;
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
}

export interface RecordPaymentResult {
  payment: Payment;
  allocation: PaymentAllocation;
  waterfallResult: WaterfallResult;
}
