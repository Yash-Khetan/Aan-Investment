import { diffInDays } from "../../common/date-utils";
import { PrincipalLedgerEvent } from "./interest.types";

/**
 * Running Balance Method: walks day by day from periodStart to periodEnd,
 * derives that day's outstanding principal from the loan's ledger of
 * disbursement tranches and principal repayments, and accrues
 * balance * dailyRate for each day. Sums to the period's total interest.
 */
export function calculateRunningBalanceInterest(input: {
  events: PrincipalLedgerEvent[];
  periodStart: Date;
  periodEnd: Date;
  dailyRate: number;
  includeOpeningClosingDays: boolean;
}): number {
  const { events, periodStart, periodEnd, dailyRate, includeOpeningClosingDays } = input;

  const totalDays = diffInDays(periodStart, periodEnd, includeOpeningClosingDays);
  if (totalDays <= 0) return 0;

  // Exclusive mode (default): the first day charged is periodStart + 1, so
  // exactly `totalDays` days are charged, the last one landing on periodEnd.
  // Inclusive mode starts charging from periodStart itself instead.
  const firstDayOffset = includeOpeningClosingDays ? 0 : 1;

  let totalInterest = 0;

  for (let i = 0; i < totalDays; i++) {
    const day = new Date(periodStart);
    day.setDate(day.getDate() + firstDayOffset + i);

    const balance = events
      .filter((event) => event.date.getTime() <= day.getTime())
      .reduce((sum, event) => sum + event.delta, 0);

    totalInterest += Math.max(balance, 0) * dailyRate;
  }

  return totalInterest;
}
