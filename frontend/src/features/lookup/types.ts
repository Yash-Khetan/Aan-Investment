export interface LoanLookup {
  id: string;
  loanAccountNumber: string;
  customerName: string;
  status: string;
  outstandingPrincipal: string;
}

export interface BorrowerLookup {
  id: string;
  borrowerCode: string;
  name: string;
}
