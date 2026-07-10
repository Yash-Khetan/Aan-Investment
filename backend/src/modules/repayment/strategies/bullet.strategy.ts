import { RepaymentStrategy, GenerateScheduleInput, GeneratedInstallment } from "../repayment.types";
import { addMonths } from "../../../common/date-utils";

/**
 * BULLET: interest paid periodically (monthly) throughout the loan term;
 * the entire principal is due as a single lump sum in the final installment.
 */
export const bulletStrategy: RepaymentStrategy = {
  generate(input: GenerateScheduleInput): GeneratedInstallment[] {
    const { principal, annualRate, tenureMonths, moratoriumMonths, disbursementDate } = input;

    const repaymentMonths = tenureMonths - moratoriumMonths;
    if (repaymentMonths <= 0) {
      throw new Error("tenureMonths must exceed moratoriumMonths for Bullet schedules.");
    }

    const monthlyRate = annualRate / 100 / 12;
    const monthlyInterest = round2(principal * monthlyRate);
    const installments: GeneratedInstallment[] = [];

    for (let i = 1; i <= repaymentMonths; i++) {
      const isLast = i === repaymentMonths;
      const principalAmount = isLast ? principal : 0;
      const interestAmount = monthlyInterest;

      installments.push({
        installmentNumber: i,
        dueDate: addMonths(disbursementDate, moratoriumMonths + i),
        principalAmount,
        interestAmount,
        totalAmount: round2(principalAmount + interestAmount),
      });
    }

    return installments;
  },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}