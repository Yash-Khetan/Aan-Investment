export const LOAN_TYPES = ["SECURED", "UNSECURED"] as const;

export const SECURITY_TYPES = [
  "PROPERTY",
  "MORTGAGE",
  "HYPOTHECATION_OF_RECEIVABLES",
  "PERSONAL_GUARANTEE",
  "CORPORATE_GUARANTEE",
  "OTHERS",
  "NONE",
] as const;

export const REPAYMENT_TYPES = ["EMI", "BULLET", "INTEREST_ONLY", "STRUCTURED", "CUSTOM"] as const;

/**
 * Tenure is never entered directly — it's derived from the disbursement and
 * maturity dates. Whole months, floored, with a 1-month minimum whenever the
 * maturity date is after the disbursement date (so a same-month loan doesn't
 * round down to a rejected 0).
 */
export function calcTenureMonths(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(months, 1);
}

export const LOAN_STATUSES = ["PENDING", "OVERDUE", "CLOSED", "WRITTEN_OFF"] as const;

export interface Loan {
  id: string;
  loanAccountNumber: string;
  borrowerId: string;
  borrowerName?: string | null;
  loanType: string;
  securityType: string | null;
  otherSecurityType: string | null;
  repaymentType: string;
  sanctionedAmount: string;
  disbursedAmount: string | null;
  outstandingPrincipal: string | null;
  interestRate: string;
  tenureMonths: number;
  moratoriumMonths: number | null;
  sanctionDate: string | null;
  firstDisbursementDate: string | null;
  maturityDate: string | null;
  purpose: string | null;
  approvalNotes: string | null;
  remarks: string | null;
  status: string | null;
  relationshipManagerId: string | null;
  createdAt: string | null;
  /** Sum of (expected - paid) across unpaid installments past due, on the current repayment schedule. */
  amountOverdue: number;
  /** Days since the oldest unpaid overdue installment's due date; 0 when nothing is overdue. */
  dpd: number;
  /** RBI-style NBFC delinquency bucket derived from dpd: STD, SMA-0, SMA-1, SMA-2, or NPA. */
  classification: string;
  /** Earliest due date among unpaid installments (overdue or upcoming); null if none. */
  nextDueDate: string | null;
  /**
   * Annualized IRR from this loan's realized cash flows (disbursements out, actual
   * payments in) plus its current outstanding principal as a final notional inflow.
   * Only present on the single-loan detail response, not the list. Null when there
   * isn't enough cash-flow data yet to solve a rate.
   */
  irr?: number | null;
}

export interface CreateLoanInput {
  loanAccountNumber: string;
  borrowerId: string;
  loanType: string;
  securityType?: string;
  otherSecurityType?: string;
  repaymentType: string;
  sanctionedAmount: number;
  disbursedAmount?: number;
  outstandingPrincipal?: number;
  interestRate: number;
  tenureMonths: number;
  moratoriumMonths?: number;
  sanctionDate?: string;
  firstDisbursementDate?: string;
  maturityDate?: string;
  purpose?: string;
  approvalNotes?: string;
  remarks?: string;
  status?: string;
}

/** Master-field update payload. Every field is sent except relationshipManagerId (left untouched — no UI to change it yet). */
export interface UpdateLoanInput {
  loanAccountNumber: string;
  borrowerId: string;
  loanType: string;
  securityType: string;
  otherSecurityType: string | null;
  repaymentType: string;
  sanctionedAmount: number;
  disbursedAmount: number;
  outstandingPrincipal: number;
  interestRate: number;
  tenureMonths: number;
  moratoriumMonths: number;
  sanctionDate: string | null;
  firstDisbursementDate: string | null;
  maturityDate: string | null;
  purpose: string | null;
  approvalNotes: string | null;
  remarks: string | null;
  status: string;
}

/** Controlled-input-friendly form state: every field is always a defined string. */
export interface LoanFormState {
  loanAccountNumber: string;
  borrowerId: string;
  loanType: string;
  securityType: string;
  otherSecurityType: string;
  repaymentType: string;
  status: string;
  sanctionedAmount: string;
  disbursedAmount: string;
  interestRate: string;
  moratoriumMonths: string;
  sanctionDate: string;
  firstDisbursementDate: string;
  maturityDate: string;
  purpose: string;
  approvalNotes: string;
  remarks: string;
}

export const EMPTY_LOAN_FORM: LoanFormState = {
  loanAccountNumber: "",
  borrowerId: "",
  loanType: "SECURED",
  securityType: "NONE",
  otherSecurityType: "",
  repaymentType: "EMI",
  status: "PENDING",
  sanctionedAmount: "",
  disbursedAmount: "",
  interestRate: "",
  moratoriumMonths: "",
  sanctionDate: "",
  firstDisbursementDate: "",
  maturityDate: "",
  purpose: "",
  approvalNotes: "",
  remarks: "",
};

export function loanToFormState(l: Loan): LoanFormState {
  return {
    loanAccountNumber: l.loanAccountNumber,
    borrowerId: l.borrowerId,
    loanType: l.loanType,
    securityType: l.securityType ?? "NONE",
    otherSecurityType: l.otherSecurityType ?? "",
    repaymentType: l.repaymentType,
    status: l.status ?? "PENDING",
    sanctionedAmount: l.sanctionedAmount ?? "",
    disbursedAmount: l.disbursedAmount ?? "",
    interestRate: l.interestRate ?? "",
    moratoriumMonths: String(l.moratoriumMonths ?? 0),
    sanctionDate: l.sanctionDate ?? "",
    firstDisbursementDate: l.firstDisbursementDate ?? "",
    maturityDate: l.maturityDate ?? "",
    purpose: l.purpose ?? "",
    approvalNotes: l.approvalNotes ?? "",
    remarks: l.remarks ?? "",
  };
}

export function formStateToCreateInput(f: LoanFormState): CreateLoanInput {
  return {
    loanAccountNumber: f.loanAccountNumber,
    borrowerId: f.borrowerId,
    loanType: f.loanType,
    securityType: f.securityType || undefined,
    otherSecurityType: f.securityType === "OTHERS" ? f.otherSecurityType || undefined : undefined,
    repaymentType: f.repaymentType,
    sanctionedAmount: Number(f.sanctionedAmount),
    disbursedAmount: f.disbursedAmount ? Number(f.disbursedAmount) : undefined,
    interestRate: Number(f.interestRate),
    tenureMonths: calcTenureMonths(f.firstDisbursementDate, f.maturityDate),
    moratoriumMonths: f.moratoriumMonths ? Number(f.moratoriumMonths) : undefined,
    sanctionDate: f.sanctionDate || undefined,
    firstDisbursementDate: f.firstDisbursementDate || undefined,
    maturityDate: f.maturityDate || undefined,
    purpose: f.purpose || undefined,
    approvalNotes: f.approvalNotes || undefined,
    remarks: f.remarks || undefined,
    status: f.status,
  };
}

export function formStateToUpdateInput(f: LoanFormState): UpdateLoanInput {
  return {
    loanAccountNumber: f.loanAccountNumber,
    borrowerId: f.borrowerId,
    loanType: f.loanType,
    securityType: f.securityType,
    otherSecurityType: f.securityType === "OTHERS" ? f.otherSecurityType || null : null,
    repaymentType: f.repaymentType,
    sanctionedAmount: Number(f.sanctionedAmount),
    disbursedAmount: Number(f.disbursedAmount || 0),
    outstandingPrincipal: 0,
    interestRate: Number(f.interestRate),
    tenureMonths: calcTenureMonths(f.firstDisbursementDate, f.maturityDate),
    moratoriumMonths: Number(f.moratoriumMonths || 0),
    sanctionDate: f.sanctionDate || null,
    firstDisbursementDate: f.firstDisbursementDate || null,
    maturityDate: f.maturityDate || null,
    purpose: f.purpose || null,
    approvalNotes: f.approvalNotes || null,
    remarks: f.remarks || null,
    status: f.status,
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ListLoansResult {
  data: Loan[];
  meta: PaginationMeta;
}
