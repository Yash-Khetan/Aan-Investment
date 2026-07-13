export type WaterfallStep = "PENALTY" | "INTEREST" | "PRINCIPAL" | "SPECIFIC_TRANCHE";

export interface WaterfallInput {
  paymentAmount: number;
  outstandingPenalty: number;
  outstandingInterest: number;
  outstandingPrincipal: number;
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
  paymentMode: string;
  transactionRef?: string;
  receivedBy?: string;
  remarks?: string;
  outstandingPenalty: number;
  outstandingInterest: number;
  outstandingPrincipal: number;
  installmentId?: string;
}