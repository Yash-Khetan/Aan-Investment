import { RepaymentStrategy, GenerateScheduleInput, GeneratedInstallment } from "../repayment.types";
import { addMonths } from "../../../common/date-utils";

/**
 * EMI (Equated Monthly Installment): each installment has an equal TOTAL
 * amount (principal + interest combined), calculated via the standard
 * amortization formula. The principal/interest split shifts over time —
 * more interest is paid early, more principal later.
 *
 * Formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 *   where P = principal, r = monthly rate, n = number of installments.
 *
 * Moratorium months are excluded from the installment count and schedule
 * entirely — no installments are generated for that period.
 */
export const emiStrategy: RepaymentStrategy = {
  generate(input: GenerateScheduleInput): GeneratedInstallment[] {
    const { principal, annualRate, tenureMonths, moratoriumMonths, disbursementDate } = input;

    const repaymentMonths = tenureMonths - moratoriumMonths;
    if (repaymentMonths <= 0) {
      throw new Error("tenureMonths must exceed moratoriumMonths for EMI schedules.");
    }

    const monthlyRate = annualRate / 100 / 12;
    const installments: GeneratedInstallment[] = [];

    let outstandingPrincipal = principal;

    const emiAmount =
      monthlyRate === 0
        ? principal / repaymentMonths
        : (principal * monthlyRate * Math.pow(1 + monthlyRate, repaymentMonths)) /
          (Math.pow(1 + monthlyRate, repaymentMonths) - 1);

    for (let i = 1; i <= repaymentMonths; i++) {
      const interestAmount = outstandingPrincipal * monthlyRate;
      let principalAmount = emiAmount - interestAmount;

      // Last installment: clear any rounding residue exactly.
      if (i === repaymentMonths) {
        principalAmount = outstandingPrincipal;
      }

      outstandingPrincipal -= principalAmount;

      // Round principal/interest first, then derive totalAmount from those rounded values —
      // never from the unrounded intermediates. Rounding principal and interest independently
      // from a totalAmount computed before that rounding can leave totalAmount a paisa off from
      // principalAmount + interestAmount, which then permanently blocks an installment from ever
      // reaching SUCCESS status even when it's fully paid (paidTotal is built from the same two
      // rounded fields, so it can never catch up to a totalAmount that was rounded independently).
      const roundedPrincipal = round2(principalAmount);
      const roundedInterest = round2(interestAmount);

      installments.push({
        installmentNumber: i,
        dueDate: addMonths(disbursementDate, moratoriumMonths + i),
        principalAmount: roundedPrincipal,
        interestAmount: roundedInterest,
        totalAmount: round2(roundedPrincipal + roundedInterest),
      });
    }

    return installments;
  },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}