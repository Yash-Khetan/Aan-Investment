export const LOAN_TYPES = ["SECURED", "UNSECURED"] as const;

export const SECURITY_TYPES = [
  "PROPERTY",
  "MORTGAGE",
  "STRUCTURED_CREDIT",
  "PERSONAL_GUARANTEE",
  "CORPORATE_GUARANTEE",
  "NONE",
] as const;

export const REPAYMENT_TYPES = ["EMI", "BULLET", "INTEREST_ONLY", "STRUCTURED", "CUSTOM"] as const;

export const LOAN_STATUSES = ["PENDING", "ACTIVE", "OVERDUE", "NPA", "CLOSED", "WRITTEN_OFF"] as const;

export interface Loan {
  id: string;
  loanAccountNumber: string;
  borrowerId: string;
  borrowerName?: string | null;
  loanType: string;
  securityType: string | null;
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
}

export interface CreateLoanInput {
  loanAccountNumber: string;
  borrowerId: string;
  loanType: string;
  securityType?: string;
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
  repaymentType: string;
  status: string;
  sanctionedAmount: string;
  disbursedAmount: string;
  outstandingPrincipal: string;
  interestRate: string;
  tenureMonths: string;
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
  repaymentType: "EMI",
  status: "PENDING",
  sanctionedAmount: "",
  disbursedAmount: "",
  outstandingPrincipal: "",
  interestRate: "",
  tenureMonths: "",
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
    repaymentType: l.repaymentType,
    status: l.status ?? "PENDING",
    sanctionedAmount: l.sanctionedAmount ?? "",
    disbursedAmount: l.disbursedAmount ?? "",
    outstandingPrincipal: l.outstandingPrincipal ?? "",
    interestRate: l.interestRate ?? "",
    tenureMonths: String(l.tenureMonths ?? ""),
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
    repaymentType: f.repaymentType,
    sanctionedAmount: Number(f.sanctionedAmount),
    disbursedAmount: f.disbursedAmount ? Number(f.disbursedAmount) : undefined,
    outstandingPrincipal: f.outstandingPrincipal ? Number(f.outstandingPrincipal) : undefined,
    interestRate: Number(f.interestRate),
    tenureMonths: Number(f.tenureMonths),
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
    repaymentType: f.repaymentType,
    sanctionedAmount: Number(f.sanctionedAmount),
    disbursedAmount: Number(f.disbursedAmount || 0),
    outstandingPrincipal: Number(f.outstandingPrincipal || 0),
    interestRate: Number(f.interestRate),
    tenureMonths: Number(f.tenureMonths),
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
