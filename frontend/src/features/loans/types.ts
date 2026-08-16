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

/** Mirrors the database's `loan_status` type — ACTIVE and NPA were missing here. */
export const LOAN_STATUSES = ["PENDING", "ACTIVE", "OVERDUE", "NPA", "CLOSED", "WRITTEN_OFF"] as const;

/* ------------------------------------------------------------------ */
/* CIBIL reporting code lists                                          */
/*                                                                     */
/* Separate from the operational lists above: `status` drives the app's */
/* own workflow while CIBIL Account Status is what gets submitted, and  */
/* likewise Credit Type vs Loan Type, Payment Frequency vs Repayment    */
/* Type. Labels reproduce the workbook's wording, codes included.       */
/* ------------------------------------------------------------------ */

export interface CodedOption {
  value: string;
  label: string;
}

/** Commercial sheet "CREDIT TYPE"; also used for the consumer sheet's un-enumerated "ACCOUNT TYPE". */
export const CREDIT_TYPES: CodedOption[] = [
  { value: "CASH_CREDIT", label: "Cash credit" },
  { value: "OVERDRAFT", label: "Overdraft" },
  { value: "DEMAND_LOAN", label: "Demand loan" },
  { value: "LOAN_THROUGH_CREDIT_CARDS", label: "Loan extended through credit cards" },
  { value: "MEDIUM_TERM_LOAN", label: "Medium term loan (above 1 year and up to 3 years)" },
  { value: "LONG_TERM_LOAN", label: "Long term loan (above 3 years)" },
  { value: "PACKING_CREDIT", label: "Packing credit (all export pre-shipment finance)" },
  { value: "EXPORT_BILLS_PURCHASED", label: "Export bills purchased" },
  { value: "EXPORT_BILLS_DISCOUNTED", label: "Export bills discounted" },
  { value: "EXPORT_BILLS_ADVANCED_AGAINST", label: "Export bills advanced against" },
  { value: "ADVANCES_AGAINST_EXPORT_INCENTIVES", label: "Advances against export cash incentives and duty draw-back claims" },
  { value: "INLAND_BILLS_PURCHASED", label: "Inland bills purchased" },
  { value: "INLAND_BILLS_DISCOUNTED", label: "Inland bills discounted" },
  { value: "ADVANCES_AGAINST_IMPORT_BILLS", label: "Advances against import bills" },
  { value: "FOREIGN_CURRENCY_CHEQUES_PURCHASED", label: "Foreign currency cheques TCS/DDS/TTS/MTS purchased" },
  { value: "LEASE_FINANCE", label: "Lease finance" },
  { value: "HIRE_PURCHASE", label: "Hire purchase" },
  { value: "BANK_GUARANTEE", label: "Bank guarantee" },
  { value: "DEFERRED_PAYMENT_GUARANTEE", label: "Deferred payment guarantee" },
  { value: "LETTERS_OF_CREDIT", label: "Letters of credit" },
  { value: "CORPORATE_CREDIT_CARD", label: "Corporate credit card" },
  { value: "COMMERCIAL_VEHICLE_LOAN", label: "Commercial vehicle loan" },
  { value: "EQUIPMENT_FINANCING", label: "Equipment financing (construction office medical)" },
  { value: "UNSECURED_BUSINESS_LOAN", label: "Unsecured business loan" },
  { value: "SHORT_TERM_LOAN", label: "Short term loan (less than 1 year)" },
  { value: "AGGREGATION_FUND_BASED", label: "Aggregation of all fund based facilities" },
  { value: "AGGREGATION_NON_FUND_BASED", label: "Aggregation of all non fund based facilities" },
  { value: "FACILITIES_INTERCHANGE", label: "Facilities interchange between fund & non fund based" },
  { value: "DERIVATIVES", label: "Derivatives" },
  { value: "PLAIN_VANILLA_FOREX_FORWARD", label: "Plain vanilla forex forward contracts" },
  { value: "PLAIN_VANILLA_INT_RATE_SWAP", label: "Plain vanilla int rate swap (all including INR as coupon)" },
  { value: "PLAIN_VANILLA_FX_OPTION", label: "Plain vanilla foreign currency option (including INR cross currency)" },
  { value: "COMPLEX_INT_RATE_DERIVATIVE", label: "Complex int rate derv with optionalities" },
  { value: "COMPLEX_FX_DERIVATIVE_WITH_OPTION", label: "Any complex derivative loan involving foreign currency with option" },
  { value: "CONTRACTS_PAST_PERFORMANCE_IMPORTS", label: "Contracts on past performance – imports" },
  { value: "CONTRACTS_PAST_PERFORMANCE_EXPORTS", label: "Contracts on past performance – exports" },
  { value: "AGGREGATE_BORROWINGS_SUIT_FILED", label: "Aggregate of all borrowings due to filing of suit" },
  { value: "AUTO_LOAN", label: "Auto Loan" },
  { value: "PROPERTY_LOAN", label: "Property Loan" },
  { value: "GOLD_LOAN", label: "Gold Loan" },
  { value: "LOAN_AGAINST_SHARES_SECURITIES", label: "Loan Against Shares/Securities" },
  { value: "HEALTHCARE_FINANCE", label: "HealthCare Finance" },
  { value: "INFRASTRUCTURE_FINANCE", label: "Infrastructure Finance" },
  { value: "FACTORING_WITH_RECOURSE_SELLER", label: "Factoring with Recourse (Seller)" },
  { value: "COMMERCIAL_PAPER", label: "Commercial Paper" },
  { value: "NCD_NON_CONVERTIBLE_DEBENTURES", label: "NCD – Non Convertible Debentures" },
  { value: "UNHEDGED_FOREIGN_CURRENCY_EXPOSURE", label: "Unhedged Foreign Currency Exposure" },
  { value: "PAYMENT_ACCOUNT", label: "Payment Account (Point of Sale & Payment Gateways)" },
  { value: "CURRENT_LOAN", label: "Current Loan" },
  { value: "ARC_SECURED_LOAN", label: "ARC – Secured Loan" },
  { value: "ARC_UNSECURED_LOAN", label: "ARC – Unsecured Loan" },
  { value: "SELLER_FINANCING", label: "Seller Financing" },
  { value: "GECL_LOAN", label: "GECL Loan" },
  { value: "MUDRA_TERM_LOAN", label: "Mudra Term Loan" },
  { value: "MUDRA_WORKING_CAPITAL", label: "Mudra Working Capital" },
  { value: "TEMPORARY_OVERDRAFT", label: "Temporary Overdraft" },
  { value: "FACTORING_WITHOUT_RECOURSE_BUYER", label: "Factoring without Recourse (Buyer)" },
  { value: "OVERDRAFT_AGAINST_FD", label: "Overdraft against FD" },
  { value: "OVERDRAFT_AGAINST_SHARES_SECURITIES", label: "Overdraft against Shares / Securities" },
  { value: "OVERDRAFT_AGAINST_COLLATERAL", label: "Overdraft against Collateral" },
  { value: "MERCHANT_ACQUIRING", label: "Merchant Acquiring" },
  { value: "GOVERNMENT_SPONSORED_LOAN", label: "Government Sponsored Loan" },
  { value: "WORKING_CAPITAL_LOAN", label: "Working Capital Loan" },
  { value: "THREE_WHEELER_LOAN", label: "3-Wheeler Loan" },
  { value: "CREDIT_EXPOSURES_CONVERTED_TO_SECURITIES", label: "Credit Exposures converted to debt/equity securities due to restructuring" },
  { value: "OTHERS", label: "Others" },
];

export const CIBIL_ACCOUNT_STATUSES: CodedOption[] = [
  { value: "OPEN", label: "01 Open" },
  { value: "CLOSED_BY_PAYMENT", label: "02 Closed By Payment" },
  { value: "SETTLED_AND_CLOSED", label: "03 Settled & Closed" },
  { value: "RESTRUCTURED", label: "04 Restructured" },
  { value: "WRITTEN_OFF", label: "05 Written Off" },
  { value: "SETTLED_POST_WRITE_OFF", label: "06 Settled Post Write Off" },
  { value: "INVOKED", label: "07 Invoked" },
  { value: "DEVOLVED", label: "08 Devolved" },
  { value: "RESTRUCTURED_DUE_TO_NATURAL_CALAMITY", label: "09 Restructured Due to Natural Calamity" },
  { value: "SOLD_TO_ARC", label: "10 Sold to ARC" },
  { value: "PURCHASE_FROM_BANK", label: "11 Purchase from Bank" },
];

export const ASSET_CLASSIFICATIONS: CodedOption[] = [
  { value: "STANDARD", label: "01 Standard" },
  { value: "SUBSTANDARD", label: "02 Substandard" },
  { value: "DOUBTFUL", label: "03 Doubtful" },
  { value: "LOSS", label: "04 Loss" },
  { value: "SPECIAL_MENTION_ACCOUNT", label: "05 Special Mention Account" },
];

/** Union of the consumer sheet's Payment Frequency and the commercial sheet's Repayment Frequency. */
export const PAYMENT_FREQUENCIES: CodedOption[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "FORTNIGHTLY", label: "Fortnightly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half yearly" },
  { value: "YEARLY", label: "Yearly / Annual" },
  { value: "BULLET", label: "Bullet payment" },
  { value: "ON_DEMAND", label: "On demand" },
  { value: "ROLLING", label: "Rolling" },
  { value: "OTHERS", label: "Others" },
];

export const CIBIL_COLLATERAL_TYPES: CodedOption[] = [
  { value: "NO_COLLATERAL", label: "00 No Collateral" },
  { value: "GOLD", label: "02 Gold" },
  { value: "SHARES", label: "03 Shares" },
  { value: "SAVINGS_ACCOUNT_AND_FIXED_DEPOSIT", label: "04 Saving Account and Fixed Deposit" },
  { value: "MULTIPLE_SECURITIES", label: "05 Multiple Securities" },
  { value: "OTHERS", label: "06 Others" },
];

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
  /* CIBIL reporting */
  creditType: string | null;
  cibilAccountStatus: string | null;
  assetClassification: string | null;
  paymentFrequency: string | null;
  emiAmount: string | null;
  collateralType: string | null;
  collateralValue: string | null;
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
  /* CIBIL reporting */
  creditType?: string;
  cibilAccountStatus?: string;
  assetClassification?: string;
  paymentFrequency?: string;
  emiAmount?: number;
  collateralType?: string;
  collateralValue?: number;
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
  /* CIBIL reporting */
  creditType: string | null;
  cibilAccountStatus: string | null;
  assetClassification: string | null;
  paymentFrequency: string | null;
  emiAmount: number | null;
  collateralType: string | null;
  collateralValue: number | null;
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
  /* CIBIL reporting */
  creditType: string;
  cibilAccountStatus: string;
  assetClassification: string;
  paymentFrequency: string;
  emiAmount: string;
  collateralType: string;
  collateralValue: string;
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
  creditType: "",
  cibilAccountStatus: "",
  assetClassification: "",
  paymentFrequency: "",
  emiAmount: "",
  collateralType: "",
  collateralValue: "",
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
    creditType: l.creditType ?? "",
    cibilAccountStatus: l.cibilAccountStatus ?? "",
    assetClassification: l.assetClassification ?? "",
    paymentFrequency: l.paymentFrequency ?? "",
    emiAmount: l.emiAmount ?? "",
    collateralType: l.collateralType ?? "",
    collateralValue: l.collateralValue ?? "",
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
    creditType: f.creditType || undefined,
    cibilAccountStatus: f.cibilAccountStatus || undefined,
    assetClassification: f.assetClassification || undefined,
    paymentFrequency: f.paymentFrequency || undefined,
    emiAmount: f.emiAmount ? Number(f.emiAmount) : undefined,
    collateralType: f.collateralType || undefined,
    collateralValue: f.collateralValue ? Number(f.collateralValue) : undefined,
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
    creditType: f.creditType || null,
    cibilAccountStatus: f.cibilAccountStatus || null,
    assetClassification: f.assetClassification || null,
    paymentFrequency: f.paymentFrequency || null,
    emiAmount: f.emiAmount ? Number(f.emiAmount) : null,
    collateralType: f.collateralType || null,
    collateralValue: f.collateralValue ? Number(f.collateralValue) : null,
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
