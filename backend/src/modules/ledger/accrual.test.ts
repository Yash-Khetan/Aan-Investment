import { describe, expect, it } from "vitest";

import type { InterestBasis } from "../interest/interest.types";
import { computeInterestAccrual, monthEndOf, type AccrualPeriod } from "./accrual";
import type { LedgerEntryRow } from "./ledger.repository";
import type { LedgerVchType, MonthAccrualConfig } from "./ledger.types";
import { computeLoanSnapshot } from "./snapshot";

/**
 * Interest accrued till today, against the ledger's own arithmetic.
 *
 * Every expected figure here is one the production engine produces for the
 * same inputs — the January pair (17,260.27 interest, 1,726.03 TDS on a
 * ₹10,00,000 disbursement at 21% ACTUAL_365) is the same pair the imported
 * -history fixture in ledgerLocking.test.ts carries, so these numbers are
 * anchored to a figure the system already had to reproduce.
 *
 * Dates are fixed throughout: every case states its own as-of date, so not
 * one assertion here depends on the day the suite runs.
 */

let seq = 0;

function row(
  loanId: string,
  entryDate: string,
  vchType: LedgerVchType,
  debit: number | null,
  credit: number | null,
  snapshotted: { ratePercent?: number; interestBasis?: InterestBasis; includeOpeningClosingDays?: boolean } = {},
): LedgerEntryRow {
  seq += 1;
  const isJournal = vchType === "JOURNAL_INTEREST" || vchType === "JOURNAL_TDS";
  return {
    id: `e${seq}`,
    loanId,
    entryDate,
    narration: null,
    vchType,
    vchNo: String(seq),
    debit: debit === null ? null : String(debit),
    credit: credit === null ? null : String(credit),
    pairedEntryId: null,
    accrualMonth: isJournal ? `${entryDate.slice(0, 7)}-01` : null,
    ratePercent: snapshotted.ratePercent === undefined ? null : String(snapshotted.ratePercent),
    interestBasis: snapshotted.interestBasis ?? null,
    includeOpeningClosingDays: snapshotted.includeOpeningClosingDays ?? null,
    isSystemGenerated: isJournal,
    sequenceNo: seq,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
  } as LedgerEntryRow;
}

const DEFAULT_CONFIG: MonthAccrualConfig = {
  interestRatePercent: 21,
  tdsRatePercent: 10,
  interestBasis: "ACTUAL_365",
  includeOpeningClosingDays: false,
};

/** An unposted month to accrue, at the default configuration unless overridden. */
function period(month: string, config: Partial<MonthAccrualConfig> = {}): AccrualPeriod {
  return { month, monthEnd: monthEndOf(month), config: { ...DEFAULT_CONFIG, ...config } };
}

/** ₹10,00,000 out on 1-Jan-2024, with January's interest/TDS pair posted at month-end. */
function januaryPosted(loanId = "L1"): LedgerEntryRow[] {
  return [
    row(loanId, "2024-01-01", "PAYMENT", 1_000_000, null),
    row(loanId, "2024-01-31", "JOURNAL_INTEREST", 17_260.27, null, {
      ratePercent: 21,
      interestBasis: "ACTUAL_365",
      includeOpeningClosingDays: false,
    }),
    row(loanId, "2024-01-31", "JOURNAL_TDS", null, 1_726.03, { ratePercent: 10 }),
  ];
}

describe("accrued interest for one loan as at a date", () => {
  const entries = januaryPosted();

  it("adds the month in progress to what is already posted", () => {
    const accrual = computeInterestAccrual(entries, "2024-02-15", [period("2024-02-01")]);

    expect(accrual.postedInterest).toBe(17_260.27);
    expect(accrual.unpostedInterest).toBe(8_179.92);
    expect(accrual.interestAccruedTillToday).toBe(25_440.19);
    expect(accrual.asOf).toBe("2024-02-15");
  });

  it("accrues on the balance January's unpaid interest left behind", () => {
    // 10,00,000 + 17,260.27 - 1,726.03 = 10,15,534.24 at 21%/365 = 584.28 a
    // day, and the exclusive day count charges 2-Feb to 15-Feb: 14 days.
    const accrual = computeInterestAccrual(entries, "2024-02-15", [period("2024-02-01")]);
    expect(accrual.unpostedInterest).toBeCloseTo(584.28 * 14, 1);
  });

  it("withholds TDS on the unposted accrual at the month's own TDS rate", () => {
    const accrual = computeInterestAccrual(entries, "2024-02-15", [period("2024-02-01")]);
    // 8,179.92 at 10% is 817.992, rounded to the paisa as every ledger
    // figure is.
    expect(accrual.unpostedTds).toBe(817.99);
    expect(accrual.tdsAdjusted).toBe(2_544.02);
  });

  it("reports where the accrual starts and where it is as at", () => {
    const accrual = computeInterestAccrual(entries, "2024-02-15", [period("2024-02-01")]);
    expect(accrual.accrualStartDate).toBe("2024-01-01");
    expect(accrual.unpostedFrom).toBe("2024-02-01");
  });

  it("is posted interest alone when no month is accruing", () => {
    const accrual = computeInterestAccrual(entries, "2024-01-31", []);
    expect(accrual.interestAccruedTillToday).toBe(17_260.27);
    expect(accrual.unpostedInterest).toBe(0);
    expect(accrual.unpostedFrom).toBeNull();
  });

  it("is all zeros on an empty ledger, never missing", () => {
    const accrual = computeInterestAccrual([], "2024-02-15", []);
    expect(accrual.interestAccruedTillToday).toBe(0);
    expect(accrual.postedInterest).toBe(0);
    expect(accrual.accrualStartDate).toBeNull();
    expect(accrual.lastPostedAccrualDate).toBeNull();
    expect(accrual.interestRatePercent).toBeNull();
  });
});

describe("from the last posted accrual through today", () => {
  it("names the last posted journal and its month", () => {
    const accrual = computeInterestAccrual(januaryPosted(), "2024-02-15", [period("2024-02-01")]);
    expect(accrual.lastPostedAccrualDate).toBe("2024-01-31");
    expect(accrual.lastPostedAccrualMonth).toBe("2024-01-01");
  });

  it("walks every month between the last posted one and today, each in full but the current one", () => {
    // February elapsed without being posted, so it accrues whole; March
    // accrues to the 15th only.
    const accrual = computeInterestAccrual(januaryPosted(), "2024-03-15", [
      period("2024-02-01"),
      period("2024-03-01"),
    ]);

    expect(accrual.unpostedMonths).toHaveLength(2);
    expect(accrual.unpostedMonths[0]).toMatchObject({
      month: "2024-02-01",
      accruedThrough: "2024-02-29",
      interestAmount: 16_359.84,
      isComplete: true,
    });
    expect(accrual.unpostedMonths[1]).toMatchObject({
      month: "2024-03-01",
      accruedThrough: "2024-03-15",
      interestAmount: 8_298.52,
      isComplete: false,
    });
    // Rounded to the paisa, not left as the float sum of the three parts.
    expect(accrual.interestAccruedTillToday).toBe(41_918.63);
  });

  it("compounds an unposted month into the balance the next one accrues on", () => {
    // March on its own, had February not been pending, would accrue on
    // 10,15,534.24 — the 8,179.92-for-14-days balance. It accrues on more
    // than that, because February's unposted net interest is in the balance.
    const withPendingFebruary = computeInterestAccrual(januaryPosted(), "2024-03-15", [
      period("2024-02-01"),
      period("2024-03-01"),
    ]);
    expect(withPendingFebruary.unpostedMonths[1]!.interestAmount).toBeGreaterThan(8_179.92);
  });

  it("ignores a month that has not begun", () => {
    const accrual = computeInterestAccrual(januaryPosted(), "2024-02-15", [
      period("2024-02-01"),
      period("2024-03-01"),
    ]);
    expect(accrual.unpostedMonths).toHaveLength(1);
  });
});

describe("day-count convention and accrual boundaries", () => {
  const entries = januaryPosted();

  it("charges nothing on the first of the month, as the exclusive count does", () => {
    const accrual = computeInterestAccrual(entries, "2024-02-01", [period("2024-02-01")]);
    expect(accrual.unpostedInterest).toBe(0);
    expect(accrual.interestAccruedTillToday).toBe(17_260.27);
  });

  it("charges exactly one day on the second", () => {
    const accrual = computeInterestAccrual(entries, "2024-02-02", [period("2024-02-01")]);
    expect(accrual.unpostedInterest).toBe(584.28);
  });

  it("counts a day more when the configuration includes opening and closing days", () => {
    const accrual = computeInterestAccrual(entries, "2024-02-15", [
      period("2024-02-01", { includeOpeningClosingDays: true }),
    ]);
    expect(accrual.unpostedInterest).toBe(8_764.2);
    expect(accrual.includeOpeningClosingDays).toBe(true);
  });

  it("divides by 360 instead of 365 on an ACTUAL_360 basis", () => {
    const accrual = computeInterestAccrual(entries, "2024-02-15", [
      period("2024-02-01", { interestBasis: "ACTUAL_360" }),
    ]);
    expect(accrual.unpostedInterest).toBe(8_293.53);
    expect(accrual.interestBasis).toBe("ACTUAL_360");
  });

  it("reports the day-count of the month in progress, not of the last posted row", () => {
    const accrual = computeInterestAccrual(entries, "2024-02-15", [
      period("2024-02-01", { interestBasis: "ACTUAL_360", interestRatePercent: 24 }),
    ]);
    expect(accrual.interestRatePercent).toBe(24);
    expect(accrual.interestBasis).toBe("ACTUAL_360");
  });

  it("falls back to the last posted row's own snapshot once nothing is accruing", () => {
    const accrual = computeInterestAccrual(entries, "2024-01-31", []);
    expect(accrual.interestRatePercent).toBe(21);
    expect(accrual.interestBasis).toBe("ACTUAL_365");
    expect(accrual.includeOpeningClosingDays).toBe(false);
  });
});

describe("a rate change inside the unposted stretch", () => {
  it("accrues each month at the rate that governs it, leaving posted months alone", () => {
    const entries = januaryPosted();
    const accrual = computeInterestAccrual(entries, "2024-03-15", [
      period("2024-02-01"),
      period("2024-03-01", { interestRatePercent: 24 }),
    ]);

    // February at 21%, March at 24% — and January's posted 17,260.27, struck
    // at the 21% snapshotted on its own row, is untouched by either.
    expect(accrual.unpostedMonths[0]!.interestAmount).toBe(16_359.84);
    expect(accrual.unpostedMonths[0]!.interestRatePercent).toBe(21);
    expect(accrual.unpostedMonths[1]!.interestAmount).toBe(9_484.02);
    expect(accrual.unpostedMonths[1]!.interestRatePercent).toBe(24);
    expect(accrual.postedInterest).toBe(17_260.27);
  });
});

describe("accrued, due and overdue are three different figures", () => {
  const entries = januaryPosted();

  it("accrued includes the month in progress; due and overdue do not", () => {
    const accrual = computeInterestAccrual(entries, "2024-02-15", [period("2024-02-01")]);

    // Due: January's interest net of its TDS, unpaid. Overdue: the same,
    // because 31-Jan is behind us. Accrued: that plus February so far.
    expect(accrual.interestDue).toBe(15_534.24);
    expect(accrual.interestOverdue).toBe(15_534.24);
    expect(accrual.interestAccruedTillToday).toBe(25_440.19);
    expect(accrual.interestAccruedTillToday).toBeGreaterThan(accrual.interestDue);
  });

  it("agrees with the loan snapshot on due and overdue", () => {
    const accrual = computeInterestAccrual(entries, "2024-02-15", [period("2024-02-01")]);
    const snapshot = computeLoanSnapshot(entries, "2024-02-15");

    expect(accrual.interestDue).toBe(snapshot.interestOutstanding);
    expect(accrual.interestOverdue).toBe(snapshot.amountOverdue);
    expect(accrual.postedInterest).toBe(snapshot.totalInterest);
  });

  it("has interest accrued but nothing due or overdue before the first month-end", () => {
    const entries = [row("L2", "2024-01-01", "PAYMENT", 1_000_000, null)];
    const accrual = computeInterestAccrual(entries, "2024-01-20", [period("2024-01-01")]);

    expect(accrual.interestAccruedTillToday).toBeGreaterThan(0);
    expect(accrual.postedInterest).toBe(0);
    expect(accrual.interestDue).toBe(0);
    expect(accrual.interestOverdue).toBe(0);
    expect(accrual.accrualStartDate).toBe("2024-01-01");
  });

  it("counts nothing overdue on a due date that has not passed", () => {
    const accrual = computeInterestAccrual(entries, "2024-01-31", []);
    expect(accrual.interestDue).toBe(15_534.24);
    expect(accrual.interestOverdue).toBe(0);
  });
});

describe("receipts, partial payments and TDS", () => {
  const withReceipt = [...januaryPosted(), row("L1", "2024-02-10", "RECEIPT", null, 10_000)];

  it("takes what was settled from the appropriation waterfall, not from the receipts", () => {
    const accrual = computeInterestAccrual(withReceipt, "2024-02-15", [period("2024-02-01")]);

    // The ₹10,000 receipt lands on January's net ₹15,534.24, oldest month
    // first, leaving ₹5,534.24 — it is not simply taken off accrued interest.
    expect(accrual.interestPaid).toBe(10_000);
    expect(accrual.interestDue).toBe(5_534.24);
    expect(accrual.interestAccruedTillToday).toBe(25_405.67);
  });

  it("accrues the rest of the month on the balance the receipt left", () => {
    const accrual = computeInterestAccrual(withReceipt, "2024-02-15", [period("2024-02-01")]);
    // Same 14 days, but ₹10,000 less principal for the last five of them.
    expect(accrual.unpostedInterest).toBe(8_145.4);
    expect(accrual.unpostedInterest).toBeLessThan(8_179.92);
  });

  it("ties out: posted interest less TDS less what was paid is what is due", () => {
    for (const asOf of ["2024-02-10", "2024-02-15", "2024-02-29"]) {
      const accrual = computeInterestAccrual(withReceipt, asOf, [period("2024-02-01")]);
      const postedTds = accrual.tdsAdjusted - accrual.unpostedTds;
      expect(accrual.postedInterest - postedTds - accrual.interestPaid).toBeCloseTo(accrual.interestDue, 2);
    }
  });

  it("a receipt bigger than the interest owed pays interest off and no more", () => {
    const entries = [...januaryPosted(), row("L1", "2024-02-10", "RECEIPT", null, 500_000)];
    const accrual = computeInterestAccrual(entries, "2024-02-15", [period("2024-02-01")]);

    expect(accrual.interestPaid).toBe(15_534.24);
    expect(accrual.interestDue).toBe(0);
    expect(accrual.interestOverdue).toBe(0);
    // Still accrued the whole month so far, on a balance the surplus reduced.
    expect(accrual.interestAccruedTillToday).toBeGreaterThan(17_260.27);
  });
});

describe("entries dated after the as-of date", () => {
  it("accrue nothing until their date arrives", () => {
    const entries = [...januaryPosted(), row("L1", "2024-03-20", "PAYMENT", 5_000_000, null)];

    const before = computeInterestAccrual(entries, "2024-03-15", [period("2024-02-01"), period("2024-03-01")]);
    const unscheduled = computeInterestAccrual(januaryPosted(), "2024-03-15", [
      period("2024-02-01"),
      period("2024-03-01"),
    ]);

    expect(before.interestAccruedTillToday).toBe(unscheduled.interestAccruedTillToday);
  });
});

describe("the portfolio aggregate", () => {
  it("is the sum of each loan's own accrual, with no month counted twice", () => {
    // Two loans of the same borrower, accrued independently.
    const loanA = januaryPosted("A");
    const loanB = [
      row("B", "2024-01-01", "PAYMENT", 2_000_000, null),
      row("B", "2024-01-31", "JOURNAL_INTEREST", 34_520.55, null, { ratePercent: 21 }),
      row("B", "2024-01-31", "JOURNAL_TDS", null, 3_452.06, { ratePercent: 10 }),
    ];

    const a = computeInterestAccrual(loanA, "2024-02-15", [period("2024-02-01")]);
    const b = computeInterestAccrual(loanB, "2024-02-15", [period("2024-02-01")]);
    const total = a.interestAccruedTillToday + b.interestAccruedTillToday;

    expect(a.interestAccruedTillToday).toBe(25_440.19);
    // Twice the principal, so almost exactly twice the accrual.
    expect(b.interestAccruedTillToday).toBeCloseTo(2 * 25_440.19, 0);
    expect(total).toBeCloseTo(a.interestAccruedTillToday + b.interestAccruedTillToday, 2);

    // Accruing one loan never reaches the other.
    expect(computeInterestAccrual(loanA, "2024-02-15", [period("2024-02-01")]).interestAccruedTillToday).toBe(
      a.interestAccruedTillToday,
    );
  });
});

describe("reading the figure changes nothing", () => {
  it("leaves the entries it was given exactly as they were", () => {
    const entries = januaryPosted();
    const copy = JSON.parse(JSON.stringify(entries));

    computeInterestAccrual(entries, "2024-02-15", [period("2024-02-01")]);
    computeInterestAccrual(entries, "2024-02-15", [period("2024-02-01")]);

    expect(JSON.parse(JSON.stringify(entries))).toEqual(copy);
  });

  it("gives the same answer however many times it is asked", () => {
    const entries = januaryPosted();
    const first = computeInterestAccrual(entries, "2024-02-15", [period("2024-02-01")]);
    const second = computeInterestAccrual(entries, "2024-02-15", [period("2024-02-01")]);
    expect(second).toEqual(first);
  });
});
