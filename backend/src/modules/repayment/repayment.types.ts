export type RepaymentType = "EMI" | "BULLET" | "INTEREST_ONLY" | "STRUCTURED" | "CUSTOM";

/**
 * Every field here is derived from the loan + its current interest config —
 * nothing is taken from the caller anymore (see repayment.service.ts). This
 * shape is what actually reaches the strategies.
 */
export interface GenerateScheduleInput {
  loanId: string;
  principal: number; // loan.disbursedAmount (cumulative disbursed, never reduced by repayments)
  annualRate: number; // percentage, e.g. 18 for 18%
  interestBasis: string;
  calculationMethod: string; // "RUNNING_BALANCE" | "SIMPLE_INTEREST"
  includeOpeningClosingDays: boolean;
  customFormula?: string | null;
  tenureMonths: number; // total months from firstDisbursementDate to maturityDate, including moratorium
  moratoriumMonths: number; // no principal/interest due during this period (SRS: "Moratorium Periods")
  disbursementDate: Date;
  repaymentType: RepaymentType;
}

export interface GeneratedInstallment {
  installmentNumber: number;
  dueDate: Date;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  /** Scheduled/projected remaining principal after this installment. */
  outstandingBalance: number;
}

export interface RepaymentStrategy {
  generate(input: GenerateScheduleInput): GeneratedInstallment[];
}
