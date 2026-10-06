import type { DpdClassification } from "../ledger/types";

/** Every money figure is summed from each loan's ledger snapshot — the same figures the Loans list shows. */
export interface PortfolioByClassification {
  classification: DpdClassification;
  loanCount: number;
  principalOutstanding: number;
  amountOverdue: number;
}

export interface PortfolioSummary {
  totals: {
    totalLoans: number;
    totalSanctioned: number;
    totalDisbursed: number;
    totalReceived: number;
    /** Principal outstanding. */
    totalOutstanding: number;
    /** Interest posted (net of TDS) and not yet received. */
    totalInterestDue: number;
    /** Principal plus unpaid interest. */
    totalPayable: number;
    /** Unpaid interest already past due. */
    totalOverdue: number;
    /** Loans with DPD above zero. */
    loansOverdue: number;
  };
  /** Loans with interest already past due, most days past due first. */
  needsAttention: NeedsAttentionLoan[];
  byClassification: PortfolioByClassification[];
}

export interface NeedsAttentionLoan {
  loanId: string;
  loanAccountNumber: string;
  borrowerName: string;
  amountOverdue: number;
  dpd: number;
  classification: DpdClassification;
  oldestOverdueDueDate: string | null;
  totalPayable: number;
}

export interface PortfolioReturns {
  /** Fraction (e.g. 0.145 = 14.5%), not a whole percentage. Null when there isn't enough cash-flow data to solve a rate. */
  overallIrr: number | null;
  overallMirr: number | null;
}

/** One disbursement or receipt dated after today. */
export interface ScheduledEntry {
  id: string;
  entryDate: string;
  type: "DISBURSEMENT" | "RECEIPT";
  amount: number;
  narration: string | null;
  loanId: string;
  loanAccountNumber: string;
  borrowerName: string;
}

export interface ScheduledWindow {
  count: number;
  disbursements: number;
  receipts: number;
}

/** Money movements dated after today. Counted in no other dashboard figure until their date arrives. */
export interface ScheduledSummary {
  next7Days: ScheduledWindow;
  next30Days: ScheduledWindow;
  all: ScheduledWindow;
  /** Soonest first. */
  entries: ScheduledEntry[];
}

export interface DashboardSummary {
  portfolio: PortfolioSummary;
  returns: PortfolioReturns;
  scheduled: ScheduledSummary;
}
