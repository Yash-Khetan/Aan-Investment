import { RepaymentStrategy, GenerateScheduleInput, GeneratedInstallment } from "../repayment.types";
import { addMonths } from "../../../common/date-utils";
import { calculatePeriodInterest } from "../../interest/interest.service";

/**
 * BULLET: interest paid periodically (monthly) throughout the loan term via
 * the loan's configured Interest Engine basis/method; the entire principal
 * is due as a single lump sum in the final installment. Since the balance
 * never declines until that final payment, RUNNING_BALANCE and
 * SIMPLE_INTEREST produce the same interest figure every period here.
 */
export const bulletStrategy: RepaymentStrategy = {
  generate(input: GenerateScheduleInput): GeneratedInstallment[] {
    const {
      principal,
      annualRate,
      interestBasis,
      calculationMethod,
      includeOpeningClosingDays,
      customFormula,
      tenureMonths,
      moratoriumMonths,
      disbursementDate,
    } = input;

    const repaymentMonths = tenureMonths - moratoriumMonths;
    if (repaymentMonths <= 0) {
      throw new Error("tenureMonths must exceed moratoriumMonths for Bullet schedules.");
    }

    const installments: GeneratedInstallment[] = [];
    let outstandingBalance = principal;
    let periodStart = disbursementDate;

    for (let i = 1; i <= repaymentMonths; i++) {
      const dueDate = addMonths(disbursementDate, moratoriumMonths + i);
      const isLast = i === repaymentMonths;
      const principalAmount = isLast ? principal : 0;

      const interestBase = calculationMethod === "RUNNING_BALANCE" ? outstandingBalance : principal;
      const interestAmount = round2(
        calculatePeriodInterest({
          interestBasis,
          annualRate,
          periodStart,
          periodEnd: dueDate,
          includeOpeningClosingDays,
          principal: interestBase,
          customFormula,
        })
      );

      outstandingBalance = round2(outstandingBalance - principalAmount);

      installments.push({
        installmentNumber: i,
        dueDate,
        principalAmount,
        interestAmount,
        totalAmount: round2(principalAmount + interestAmount),
        outstandingBalance,
      });

      periodStart = dueDate;
    }

    return installments;
  },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
