export type VchType = "Payment" | "Receipt" | "Journal" | (string & {});

export interface RowParameter {
  id: string;
  name: string;
  /** Stored as a plain number. If the user entered it as a percentage, this is already value/100. */
  value: number;
  isPercent: boolean;
}

export interface RowOutput {
  name: string;
  formula: string;
  result: number | null;
  error?: string;
}

export interface LedgerRow {
  id: string;
  date: string | null;
  particulars: string;
  vchType: VchType | null;
  vchNo: string | null;
  debit: number | null;
  credit: number | null;
  /** Signed balance derived from the raw "<amount> Dr"/"<amount> Cr" cell. Positive = Dr, negative = Cr. */
  balance: number | null;
  parameters: RowParameter[];
  output: RowOutput | null;
}

export interface ImportSettings {
  standardInterestRate: number;
  standardTdsRate: number;
}
