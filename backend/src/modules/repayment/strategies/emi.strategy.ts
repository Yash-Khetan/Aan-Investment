import { RepaymentStrategy, GenerateScheduleInput, GeneratedInstallment } from "../repayment.types";
import { addMonths } from "../../../common/date-utils";
import { calculatePeriodInterest } from "../../interest/interest.service";

/**
 * EMI (Equated Monthly Installment): principal is split equally across every
 * installment (the last one absorbs any rounding residue). Interest for each
 * installment is computed via the loan's actual configured Interest Engine
 * basis/method — RUNNING_BALANCE prices interest on that period's declining
 * scheduled balance, SIMPLE_INTEREST always prices it on the original
 * principal. Because the interest portion isn't assumed to be constant
 * month to month (it depends on the real configured basis, not a fixed
 * monthly-compounding formula), the total installment amount can vary
 * slightly instead of being a single constant EMI figure.
 */
export const emiStrategy: RepaymentStrategy = {
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
      throw new Error("tenureMonths must exceed moratoriumMonths for EMI schedules.");
    }

    const equalPrincipal = round2(principal / repaymentMonths);
    const installments: GeneratedInstallment[] = [];

    let outstandingBalance = principal;
    let periodStart = disbursementDate;

    for (let i = 1; i <= repaymentMonths; i++) {
      const dueDate = addMonths(disbursementDate, moratoriumMonths + i);
      const isLast = i === repaymentMonths;

      // Last installment clears any rounding residue exactly.
      const principalAmount = isLast ? round2(outstandingBalance) : equalPrincipal;

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
