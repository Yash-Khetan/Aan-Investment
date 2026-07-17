import { RepaymentStrategy, GenerateScheduleInput, GeneratedInstallment } from "../repayment.types";
import { addMonths } from "../../../common/date-utils";

/**
 * INTEREST_ONLY: borrower pays only interest for the full tenure; principal
 * is never scheduled for repayment through this engine (expected to be
 * settled separately — e.g. a manual closure/rollover, outside V1 scope).
 */
export const interestOnlyStrategy: RepaymentStrategy = {
  generate(input: GenerateScheduleInput): GeneratedInstallment[] {
    const { principal, annualRate, tenureMonths, moratoriumMonths, disbursementDate } = input;

    const repaymentMonths = tenureMonths - moratoriumMonths;
    if (repaymentMonths <= 0) {
      throw new Error("tenureMonths must exceed moratoriumMonths for Interest-Only schedules.");
    }

    const monthlyRate = annualRate / 100 / 12;
    const monthlyInterest = round2(principal * monthlyRate);
    const installments: GeneratedInstallment[] = [];

    for (let i = 1; i <= repaymentMonths; i++) {
      installments.push({
        installmentNumber: i,
        dueDate: addMonths(disbursementDate, moratoriumMonths + i),
        principalAmount: 0,
        interestAmount: monthlyInterest,
        totalAmount: monthlyInterest,
      });
    }

    return installments;
  },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}