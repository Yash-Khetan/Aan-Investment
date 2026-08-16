import { RepaymentStrategy, GenerateScheduleInput, GeneratedInstallment } from "../repayment.types";
import { addMonths } from "../../../common/date-utils";
import { calculatePeriodInterest } from "../../interest/interest.service";

/**
 * INTEREST_ONLY: borrower pays only interest for the full tenure, computed
 * via the loan's configured Interest Engine basis/method; principal is never
 * scheduled for repayment through this engine (expected to be settled
 * separately — e.g. a manual closure/rollover, outside V1 scope). The
 * balance never declines, so RUNNING_BALANCE and SIMPLE_INTEREST are
 * identical here.
 */
export const interestOnlyStrategy: RepaymentStrategy = {
  generate(input: GenerateScheduleInput): GeneratedInstallment[] {
    const {
      principal,
      annualRate,
      interestBasis,
      includeOpeningClosingDays,
      customFormula,
      tenureMonths,
      moratoriumMonths,
      disbursementDate,
    } = input;

    const repaymentMonths = tenureMonths - moratoriumMonths;
    if (repaymentMonths <= 0) {
      throw new Error("tenureMonths must exceed moratoriumMonths for Interest-Only schedules.");
    }

    const installments: GeneratedInstallment[] = [];
    let periodStart = disbursementDate;

    for (let i = 1; i <= repaymentMonths; i++) {
      const dueDate = addMonths(disbursementDate, moratoriumMonths + i);

      const interestAmount = round2(
        calculatePeriodInterest({
          interestBasis,
          annualRate,
          periodStart,
          periodEnd: dueDate,
          includeOpeningClosingDays,
          principal,
          customFormula,
        })
      );

      installments.push({
        installmentNumber: i,
        dueDate,
        principalAmount: 0,
        interestAmount,
        totalAmount: interestAmount,
        outstandingBalance: principal,
      });

      periodStart = dueDate;
    }

    return installments;
  },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
