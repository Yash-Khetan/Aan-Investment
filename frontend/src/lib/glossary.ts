/**
 * The one name each money figure goes by, on every screen. A figure that
 * appears in two places must read the same in both, so non-technical staff
 * learn each word once. Use these instead of writing a label inline.
 */
export const FIGURE = {
  sanctioned: "Sanctioned",
  disbursed: "Disbursed",
  received: "Received",
  principalOutstanding: "Principal outstanding",
  interestDue: "Interest due",
  totalPayable: "Total payable",
  overdue: "Overdue",
  dpd: "DPD",
  classification: "Classification",
  nextDue: "Next due",
  rate: "Interest rate",
} as const;
