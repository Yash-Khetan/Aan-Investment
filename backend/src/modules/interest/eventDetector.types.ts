export interface InstallmentSnapshot {
  id: string;
  dueDate: Date;
  status: "PENDING" | "PARTIAL" | "SUCCESS" | "FAILED" | "CANCELLED";
}

export interface LoanEventContext {
  asOfDate: Date;
  installments: InstallmentSnapshot[];
  wasExtended: boolean; // true if loan's maturityDate was pushed out via an edit
}

export const EVENT_PAYMENT_DELAYED = "PAYMENT_DELAYED";
export const EVENT_LOAN_EXTENDED = "LOAN_EXTENDED";