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
  byClassification: PortfolioByClassification[];
}

export interface PortfolioReturns {
  /** Fraction (e.g. 0.145 = 14.5%), not a whole percentage. Null when there isn't enough cash-flow data to solve a rate. */
  overallIrr: number | null;
  overallMirr: number | null;
}

export interface DashboardSummary {
  portfolio: PortfolioSummary;
  returns: PortfolioReturns;
}
