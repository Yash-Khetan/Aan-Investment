import { LoanEventContext } from "./eventDetector.types";
import { EVENT_PAYMENT_DELAYED, EVENT_LOAN_EXTENDED } from "./eventDetector.types";

/**
 * Detects which interest-affecting events are currently active for a loan.
 * Output feeds directly into rateResolver's `activeEvents` input.
 *
 * PAYMENT_DELAYED: any installment past its dueDate that hasn't been
 * fully paid (status is PENDING, PARTIAL, or FAILED as of asOfDate).
 *
 * LOAN_EXTENDED: driven by a flag rather than computed here, since
 * "extension" is a discrete action (editing maturityDate) recorded
 * elsewhere (loanStatusHistory), not a date comparison.
 */
export function detectActiveEvents(context: LoanEventContext): string[] {
  const events: string[] = [];

  const hasDelayedPayment = context.installments.some((inst) => {
    const isUnpaid = inst.status === "PENDING" || inst.status === "PARTIAL" || inst.status === "FAILED";
    const isPastDue = inst.dueDate < context.asOfDate;
    return isUnpaid && isPastDue;
  });

  if (hasDelayedPayment) {
    events.push(EVENT_PAYMENT_DELAYED);
  }

  if (context.wasExtended) {
    events.push(EVENT_LOAN_EXTENDED);
  }

  return events;
}