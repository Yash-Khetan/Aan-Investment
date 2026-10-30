import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";

/**
 * Interest accrued till today against a real Postgres, migrated with the
 * project's own migrations (src/test/testDb.ts), so the configuration
 * resolution below is the effective-dated read that runs in production and
 * the journals are really posted rows.
 *
 * Three things only a real database can show: that a month in the unposted
 * stretch resolves the interest configuration in force for it rather than
 * the loan's current one, that a posted month keeps the rate snapshotted on
 * its own row when the rate later changes, and that reading the figure
 * writes nothing.
 *
 * "Today" is frozen at 15-Jun-2024. The ledger posts month-end journals up
 * to the last fully elapsed month, so a loan disbursed on 1-Jan-2024 has
 * January to May posted and June — the month in progress — accruing with no
 * journal of its own.
 */

vi.mock("../../db", async () => {
  const { mockDbModule } = await import("../../test/testDb");
  return mockDbModule();
});

import { interestConfigs, ledgerEntries, loans } from "../../db/schema";
import { seedLoan } from "../../test/seed";
import { migrateTestDb, testDb } from "../../test/testDb";
import { getPortfolioSummary } from "../dashboard/dashboard.service";
import { getAccrualsFromLedgers, getLoanAccrual, getLoanLedgerFigures } from "./accrual.service";
import { recordPaymentOrReceipt } from "./ledger.service";
import { getEntriesForLoan } from "./ledger.repository";
import { getSyncedLedgers } from "./snapshot.service";

const TODAY = new Date(2024, 5, 15, 12, 0, 0);

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  await migrateTestDb();
});

afterAll(() => {
  vi.useRealTimers();
});

/** Every ledger row on a loan, and how many of them are month-end journals. */
async function ledgerShape(loanId: string) {
  const rows = await getEntriesForLoan(loanId);
  return {
    total: rows.length,
    accrualMonths: rows
      .filter((r) => r.vchType === "JOURNAL_INTEREST")
      .map((r) => r.accrualMonth)
      .sort(),
  };
}

describe("a loan whose current month has not been posted yet", () => {
  let loanId: string;

  beforeAll(async () => {
    ({ loanId } = await seedLoan({ effectiveFrom: "2024-01-01", maturityDate: "2026-01-01" }));
    await recordPaymentOrReceipt({
      loanId,
      entryDate: "2024-01-01",
      vchType: "PAYMENT",
      amount: 1_000_000,
    });
  });

  it("posts January to May, leaving June in progress", async () => {
    const accrual = await getLoanAccrual(loanId);

    expect(accrual.asOf).toBe("2024-06-15");
    expect(accrual.lastPostedAccrualMonth).toBe("2024-05-01");
    expect(accrual.lastPostedAccrualDate).toBe("2024-05-31");
    expect(accrual.unpostedFrom).toBe("2024-06-01");
    expect(accrual.unpostedMonths).toHaveLength(1);
    expect(accrual.unpostedMonths[0]!.isComplete).toBe(false);
    expect(accrual.unpostedMonths[0]!.accruedThrough).toBe("2024-06-15");
  });

  it("accrues through today even though the latest journal is from May", async () => {
    const { snapshot, accrual } = (await getLoanLedgerFigures([loanId])).get(loanId)!;

    expect(accrual.postedInterest).toBe(snapshot.totalInterest);
    expect(accrual.unpostedInterest).toBeGreaterThan(0);
    expect(accrual.interestAccruedTillToday).toBeCloseTo(
      accrual.postedInterest + accrual.unpostedInterest,
      2,
    );
    expect(accrual.interestAccruedTillToday).toBeGreaterThan(snapshot.totalInterest);
  });

  it("keeps accrued apart from due and overdue", async () => {
    const { snapshot, accrual } = (await getLoanLedgerFigures([loanId])).get(loanId)!;

    expect(accrual.interestDue).toBe(snapshot.interestOutstanding);
    expect(accrual.interestOverdue).toBe(snapshot.amountOverdue);
    // June has accrued but is not yet payable, so accrued exceeds due.
    expect(accrual.interestAccruedTillToday).toBeGreaterThan(accrual.interestDue);
  });

  it("starts the accrual at the loan's first month", async () => {
    const accrual = await getLoanAccrual(loanId);
    expect(accrual.accrualStartDate).toBe("2024-01-01");
  });

  it("reads the same figure at an earlier as-of date without the later months", async () => {
    const asOfMarch = (await getLoanLedgerFigures([loanId], "2024-03-10")).get(loanId)!.accrual;
    const asOfToday = (await getLoanLedgerFigures([loanId])).get(loanId)!.accrual;

    expect(asOfMarch.lastPostedAccrualMonth).toBe("2024-02-01");
    expect(asOfMarch.unpostedFrom).toBe("2024-03-01");
    expect(asOfMarch.interestAccruedTillToday).toBeLessThan(asOfToday.interestAccruedTillToday);
  });
});

describe("reading the figure posts nothing", () => {
  let loanId: string;

  beforeAll(async () => {
    ({ loanId } = await seedLoan({ effectiveFrom: "2024-01-01" }));
    await recordPaymentOrReceipt({
      loanId,
      entryDate: "2024-01-01",
      vchType: "PAYMENT",
      amount: 500_000,
    });
    // The ledger's own self-heal runs on the first read, as it always has.
    await getLoanLedgerFigures([loanId]);
  });

  it("creates no ledger entry and no journal, however often it is read", async () => {
    const before = await ledgerShape(loanId);

    await getLoanAccrual(loanId);
    await getLoanLedgerFigures([loanId]);
    await getPortfolioSummary();
    await getPortfolioSummary();

    expect(await ledgerShape(loanId)).toEqual(before);
  });

  it("creates no journal for the month in progress", async () => {
    await getLoanAccrual(loanId);
    const { accrualMonths } = await ledgerShape(loanId);
    expect(accrualMonths).not.toContain("2024-06-01");
  });

  it("leaves the interest configuration untouched", async () => {
    const before = await testDb.select().from(interestConfigs).where(eq(interestConfigs.loanId, loanId));

    await getLoanAccrual(loanId);
    await getPortfolioSummary();

    const after = await testDb.select().from(interestConfigs).where(eq(interestConfigs.loanId, loanId));
    expect(after).toEqual(before);
  });

  it("gives the same figure on every read", async () => {
    const first = await getLoanAccrual(loanId);
    const second = await getLoanAccrual(loanId);
    expect(second).toEqual(first);
  });
});

describe("a rate change part-way through the loan", () => {
  let loanId: string;

  beforeAll(async () => {
    ({ loanId } = await seedLoan({ effectiveFrom: "2024-01-01", annualRate: "21.0000" }));
    await recordPaymentOrReceipt({
      loanId,
      entryDate: "2024-01-01",
      vchType: "PAYMENT",
      amount: 1_000_000,
    });
    // Post January to May at 21%, then raise the rate from 1-Jun-2024.
    await getLoanLedgerFigures([loanId]);
    await testDb
      .update(interestConfigs)
      .set({ isCurrent: false, effectiveTo: "2024-06-01" })
      .where(and(eq(interestConfigs.loanId, loanId), eq(interestConfigs.isCurrent, true)));
    await testDb.insert(interestConfigs).values({
      loanId,
      annualRate: "24.0000",
      tdsRatePercent: "10.00",
      interestBasis: "ACTUAL_365",
      effectiveFrom: "2024-06-01",
      isCurrent: true,
      includeOpeningClosingDays: false,
    });
  });

  it("accrues the month in progress at the new rate", async () => {
    const accrual = await getLoanAccrual(loanId);
    expect(accrual.unpostedMonths[0]!.month).toBe("2024-06-01");
    expect(accrual.unpostedMonths[0]!.interestRatePercent).toBe(24);
    expect(accrual.interestRatePercent).toBe(24);
  });

  it("leaves every posted month at the rate snapshotted on its own row", async () => {
    const rows = await testDb
      .select({ accrualMonth: ledgerEntries.accrualMonth, ratePercent: ledgerEntries.ratePercent })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.loanId, loanId), eq(ledgerEntries.vchType, "JOURNAL_INTEREST")));

    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(Number(row.ratePercent)).toBe(21);
    }
  });

  it("does not let the new rate reach back into what was already accrued", async () => {
    const accrual = await getLoanAccrual(loanId);
    const { snapshot } = (await getLoanLedgerFigures([loanId])).get(loanId)!;
    expect(accrual.postedInterest).toBe(snapshot.totalInterest);
  });

  it("accrues a month that elapsed before the change at the old rate", async () => {
    // Resolved as at 31-May-2024, so the 1-Jun revision cannot govern it.
    const accrual = await getLoanAccrual(loanId, "2024-05-20");
    expect(accrual.unpostedMonths[0]!.month).toBe("2024-05-01");
    expect(accrual.unpostedMonths[0]!.interestRatePercent).toBe(21);
  });
});

describe("a CLOSED loan", () => {
  let loanId: string;

  beforeAll(async () => {
    ({ loanId } = await seedLoan({ effectiveFrom: "2024-01-01" }));
    await recordPaymentOrReceipt({
      loanId,
      entryDate: "2024-01-01",
      vchType: "PAYMENT",
      amount: 800_000,
    });
    await getLoanLedgerFigures([loanId]);
    await testDb.update(loans).set({ status: "CLOSED" }).where(eq(loans.id, loanId));
  });

  it("accrues nothing beyond what is already posted, as month-end posting does not either", async () => {
    const { snapshot, accrual } = (await getLoanLedgerFigures([loanId])).get(loanId)!;

    expect(accrual.unpostedInterest).toBe(0);
    expect(accrual.unpostedMonths).toEqual([]);
    expect(accrual.unpostedFrom).toBeNull();
    expect(accrual.interestAccruedTillToday).toBe(snapshot.totalInterest);
  });
});

describe("a loan with nothing disbursed", () => {
  it("accrues nothing and is never missing from the result", async () => {
    const { loanId } = await seedLoan({ effectiveFrom: "2024-01-01" });
    const figures = await getLoanLedgerFigures([loanId]);

    expect(figures.has(loanId)).toBe(true);
    const { accrual } = figures.get(loanId)!;
    expect(accrual.interestAccruedTillToday).toBe(0);
    expect(accrual.accrualStartDate).toBeNull();
    expect(accrual.unpostedMonths).toEqual([]);
  });
});

describe("two loans of the same borrower", () => {
  let first: string;
  let second: string;

  beforeAll(async () => {
    const seeded = await seedLoan({ effectiveFrom: "2024-01-01" });
    first = seeded.loanId;

    const [other] = await testDb
      .insert(loans)
      .values({
        loanAccountNumber: `LN-SHARED-${Date.now()}`,
        borrowerId: seeded.borrowerId,
        loanType: "UNSECURED",
        repaymentType: "BULLET",
        sanctionedAmount: "10000000.00",
        tenureMonths: 24,
        sanctionDate: "2024-01-01",
        maturityDate: "2026-01-01",
        status: "ACTIVE",
        createdBy: seeded.userId,
      })
      .returning({ id: loans.id });
    second = other!.id;

    await testDb.insert(interestConfigs).values({
      loanId: second,
      annualRate: "21.0000",
      tdsRatePercent: "10.00",
      interestBasis: "ACTUAL_365",
      effectiveFrom: "2024-01-01",
      isCurrent: true,
      includeOpeningClosingDays: false,
    });

    await recordPaymentOrReceipt({ loanId: first, entryDate: "2024-01-01", vchType: "PAYMENT", amount: 1_000_000 });
    await recordPaymentOrReceipt({ loanId: second, entryDate: "2024-01-01", vchType: "PAYMENT", amount: 3_000_000 });
  });

  it("accrues each on its own ledger", async () => {
    const figures = await getLoanLedgerFigures([first, second]);
    const a = figures.get(first)!.accrual;
    const b = figures.get(second)!.accrual;

    // Three times the principal on the same terms over the same days.
    expect(b.interestAccruedTillToday).toBeCloseTo(3 * a.interestAccruedTillToday, 0);
    expect(a.interestAccruedTillToday).toBeGreaterThan(0);
  });

  it("is summed, not merged, by the accrual batch read", async () => {
    const ledgers = await getSyncedLedgers([first, second]);
    const accruals = await getAccrualsFromLedgers(ledgers, "2024-06-15");
    const alone = await getLoanAccrual(first);

    expect(accruals.get(first)!.interestAccruedTillToday).toBe(alone.interestAccruedTillToday);
  });
});

describe("the dashboard aggregate", () => {
  it("is the sum of every loan's accrued interest", async () => {
    const loanRows = await testDb.select({ id: loans.id }).from(loans).where(sql`deleted_at is null`);
    const figures = await getLoanLedgerFigures(loanRows.map((l) => l.id));

    const expected =
      Math.round(
        [...figures.values()].reduce((sum, f) => sum + f.accrual.interestAccruedTillToday, 0) * 100,
      ) / 100;

    const summary = await getPortfolioSummary();
    expect(summary.totals.totalInterestAccrued).toBeCloseTo(expected, 2);
  });

  it("is at least the interest already posted, and more while a month is in progress", async () => {
    const summary = await getPortfolioSummary();
    expect(summary.totals.totalInterestAccrued).toBeGreaterThan(summary.totals.totalInterestDue);
  });

  it("leaves every other dashboard figure as it was", async () => {
    const loanRows = await testDb.select({ id: loans.id }).from(loans).where(sql`deleted_at is null`);
    const figures = await getLoanLedgerFigures(loanRows.map((l) => l.id));
    const snapshots = [...figures.values()].map((f) => f.snapshot);

    const sum = (pick: (s: (typeof snapshots)[number]) => number) =>
      Math.round(snapshots.reduce((acc, s) => acc + pick(s), 0) * 100) / 100;

    const summary = await getPortfolioSummary();
    expect(summary.totals.totalDisbursed).toBeCloseTo(sum((s) => s.totalDisbursed), 2);
    expect(summary.totals.totalReceived).toBeCloseTo(sum((s) => s.totalReceived), 2);
    expect(summary.totals.totalOutstanding).toBeCloseTo(sum((s) => s.principalOutstanding), 2);
    expect(summary.totals.totalInterestDue).toBeCloseTo(sum((s) => s.interestOutstanding), 2);
    expect(summary.totals.totalPayable).toBeCloseTo(sum((s) => s.totalPayable), 2);
    expect(summary.totals.totalOverdue).toBeCloseTo(sum((s) => s.amountOverdue), 2);
  });
});
