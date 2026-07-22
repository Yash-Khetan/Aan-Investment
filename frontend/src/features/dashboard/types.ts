export interface PortfolioByStatus {
  status: string;
  loanCount: number;
  sanctionedAmount: number;
  disbursedAmount: number;
  outstandingPrincipal: number;
}

export interface PortfolioSummary {
  totals: {
    totalLoans: number;
    totalSanctioned: number;
    totalDisbursed: number;
    totalOutstanding: number;
  };
  byStatus: PortfolioByStatus[];
}

export interface CollectionsByStatus {
  status: string;
  caseCount: number;
  overdueAmount: number;
}

export interface CollectionsSummary {
  openCases: number;
  totalOverdueAmount: number;
  byStatus: CollectionsByStatus[];
  upcomingFollowUps: number;
  overdueInstallments: {
    count: number;
    totalAmount: number;
  };
}

export interface PortfolioReturns {
  /** Fraction (e.g. 0.145 = 14.5%), not a whole percentage. Null when there isn't enough cash-flow data to solve a rate. */
  overallIrr: number | null;
  overallMirr: number | null;
}

export interface DashboardSummary {
  portfolio: PortfolioSummary;
  collections: CollectionsSummary;
  returns: PortfolioReturns;
}
