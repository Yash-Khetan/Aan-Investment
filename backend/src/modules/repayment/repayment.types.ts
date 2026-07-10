export type RepaymentType = "EMI" | "BULLET" | "INTEREST_ONLY" | "STRUCTURED" | "CUSTOM";

export interface GenerateScheduleInput {
  loanId: string;
  principal: number;
  annualRate: number; // percentage, e.g. 18 for 18%
  tenureMonths: number;
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
}

export interface RepaymentStrategy {
  generate(input: GenerateScheduleInput): GeneratedInstallment[];
}