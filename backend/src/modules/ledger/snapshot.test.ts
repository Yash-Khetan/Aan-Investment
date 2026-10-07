import { describe, expect, it } from "vitest";

import gaf from "./__fixtures__/gaf.json";
import type { LedgerEntryRow } from "./ledger.repository";
import type { LedgerVchType } from "./ledger.types";
import { computeDpdAsOf } from "./dpd";
import { computeLoanSnapshot } from "./snapshot";
import { ledgerCashFlows } from "./cashFlows";

/**
 * GAF.xlsx — two real historical ledgers (amounts, dates and voucher types
 * only; names and narration left out), each carrying the Balance column the
 * source system printed beside every row. They are the reference the
 * ledger's figures must reproduce.
 */
interface FixtureRow {
  date: string;
  type: LedgerVchType;
  debit: number | null;
  credit: number | null;
  balance: number;
}

let seq = 0;
function row(loanId: string, entryDate: string, vchType: LedgerVchType, debit: number | null, credit: number | null): LedgerEntryRow {
  seq += 1;
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
    accrualMonth: null,
    ratePercent: null,
    interestBasis: null,
    includeOpeningClosingDays: null,
    isSystemGenerated: false,
    sequenceNo: seq,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
  } as LedgerEntryRow;
}

function toEntries(loanId: string, rows: FixtureRow[]): LedgerEntryRow[] {
  return rows.map((r) => row(loanId, r.date, r.type, r.debit, r.credit));
}

const ledgers = Object.entries(gaf as Record<string, FixtureRow[]>);

describe.each(ledgers)("GAF %s", (name, rows) => {
  const entries = toEntries(name, rows);

  it("reproduces the sheet's balance after every row", () => {
    // Snapshot as at each row's date, counting only the rows up to it —
    // computeLoanSnapshot throws if principal + unpaid interest ever
    // fails to equal the balance, so this also proves the bifurcation
    // ties out at every step.
    rows.forEach((r, i) => {
      const upToHere = entries.slice(0, i + 1);
      const snapshot = computeLoanSnapshot(upToHere, r.date);
      expect(snapshot.closingBalance).toBeCloseTo(r.balance, 2);
      expect(snapshot.totalPayable).toBeCloseTo(r.balance, 2);
    });
  });

  it("closes at zero on 6-Aug-2026 with nothing owed", () => {
    const snapshot = computeLoanSnapshot(entries, "2026-08-06");
    expect(snapshot.closingBalance).toBe(0);
    expect(snapshot.principalOutstanding).toBe(0);
    expect(snapshot.interestOutstanding).toBe(0);
    expect(snapshot.bifurcation.interest).toEqual([]);
    expect(snapshot.amountOverdue).toBe(0);
    expect(snapshot.dpd).toBe(0);
    expect(snapshot.classification).toBe("STD");
    expect(snapshot.nextDueDate).toBeNull();
  });

  it("totals match the sheet's own columns", () => {
    const snapshot = computeLoanSnapshot(entries, "2026-12-31");
    const sum = (type: LedgerVchType, side: "debit" | "credit") =>
      rows.filter((r) => r.type === type).reduce((s, r) => s + (r[side] ?? 0), 0);
    expect(snapshot.totalDisbursed).toBeCloseTo(sum("PAYMENT", "debit"), 2);
    expect(snapshot.totalReceived).toBeCloseTo(sum("RECEIPT", "credit"), 2);
    expect(snapshot.totalInterest).toBeCloseTo(sum("JOURNAL_INTEREST", "debit"), 2);
    expect(snapshot.totalTds).toBeCloseTo(sum("JOURNAL_TDS", "credit"), 2);
  });

  it("a fully repaid loan has no notional closing flow in its IRR series", () => {
    const flows = ledgerCashFlows(entries, "2026-12-31");
    const net = flows.reduce((s, f) => s + f.amount, 0);
    // Out: disbursements. In: receipts + TDS. Net is the net interest earned.
    const snapshot = computeLoanSnapshot(entries, "2026-12-31");
    expect(net).toBeCloseTo(snapshot.totalInterest, 2);
  });
});

describe("GAF ledgerA on 31-Mar-2026", () => {
  const entries = toEntries("A", (gaf as Record<string, FixtureRow[]>).ledgerA!);
  const snapshot = computeLoanSnapshot(entries, "2026-03-31");

  it("splits the balance into the ₹4,10,15,000 principal the sheet charges interest on, plus unpaid interest", () => {
    expect(snapshot.closingBalance).toBe(42952958);
    expect(snapshot.principalOutstanding).toBe(41015000);
    expect(snapshot.interestOutstanding).toBe(42952958 - 41015000);
  });
});

describe("proportional DPD", () => {
  // The worked example in dpd.ts: dues of 1, 2 and 3 over 30-day periods,
  // met by a receipt of 2, clear the first, leave half the second (15 days)
  // and all the third (30 days): 45 DPD, with 4 still overdue.
  const entries = [
    row("D", "2026-01-01", "PAYMENT", 1000, null),
    row("D", "2026-01-31", "JOURNAL_INTEREST", 1, null),
    row("D", "2026-03-02", "JOURNAL_INTEREST", 2, null),
    row("D", "2026-04-01", "JOURNAL_INTEREST", 3, null),
    row("D", "2026-04-15", "RECEIPT", null, 2),
  ];

  it("counts a part-paid month in proportion to what is unpaid", () => {
    const result = computeDpdAsOf(entries, "2026-05-01");
    expect(result.dpdDays).toBe(45);
    expect(result.amountOverdue).toBe(4);
    expect(result.classification).toBe("SMA-1");
    expect(result.oldestOverdueDueDate).toBe("2026-03-02");
  });

  it("the snapshot reports the same DPD and overdue as the grid", () => {
    const snapshot = computeLoanSnapshot(entries, "2026-05-01");
    expect(snapshot.dpd).toBe(45);
    expect(snapshot.amountOverdue).toBe(4);
    expect(snapshot.nextDueDate).toBe("2026-03-02");
  });
});

describe("empty ledger", () => {
  it("is all zeros, never missing", () => {
    const snapshot = computeLoanSnapshot([], "2026-10-06");
    expect(snapshot.hasEntries).toBe(false);
    expect(snapshot.totalPayable).toBe(0);
    expect(snapshot.dpd).toBe(0);
    expect(snapshot.classification).toBe("STD");
    expect(snapshot.nextDueDate).toBeNull();
  });
});
