export interface Disbursement {
  id: string;
  loanId: string;
  trancheNumber: number;
  amount: string;
  disbursementDate: string | null;
  remarks: string | null;
  createdAt: string | null;
}

export interface RecordDisbursementInput {
  amount: number;
  disbursementDate: string;
  remarks?: string;
}
