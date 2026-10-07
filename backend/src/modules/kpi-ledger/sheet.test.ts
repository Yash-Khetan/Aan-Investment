import { describe, expect, it } from "vitest";

import sheets from "./gaf-sheets.fixture.json";
import { analyzeSheet, firstSystemAccrualMonth, parseAmount, parseBalance, parseSheetDate, type SheetRowInput } from "./sheet";
import type { LedgerEntryRow } from "../ledger/ledger.repository";
import { computeLoanSnapshot } from "../ledger/snapshot";

/**
 * GAF.xlsx — both sheets, as the browser sends them: every cell as text.
 * Names are replaced with generic labels; dates, voucher types, numbers,
 * amounts and balances are the sheets' own.
 */
const GAF = sheets as Record<string, SheetRowInput[]>;

/** The ledger rows an analysis would post, in sheet order. */
function toLedgerRows(loanId: string, rows: ReturnType<typeof analyzeSheet>["rows"]): LedgerEntryRow[] {
  return rows
    .filter((r) => r.kind)
    .map(
      (r, i) =>
        ({
          id: `${loanId}-${i}`,
          loanId,
          entryDate: r.entryDate!,
          narration: r.narration,
          vchType: r.kind!,
          vchNo: String(i + 1),
          debit: r.kind === "PAYMENT" || r.kind === "JOURNAL_INTEREST" ? String(r.amount) : null,
          credit: r.kind === "RECEIPT" || r.kind === "JOURNAL_TDS" ? String(r.amount) : null,
          pairedEntryId: null,
          accrualMonth: r.kind!.startsWith("JOURNAL") ? `${r.entryDate!.slice(0, 7)}-01` : null,
          ratePercent: null,
          interestBasis: null,
          includeOpeningClosingDays: null,
          isSystemGenerated: false,
          source: "IMPORT",
          importId: "import",
          sourceVchType: r.sourceVchType,
          sourceVchNo: r.sourceVchNo,
          effectiveLoggedAt: null,
          sequenceNo: i + 1,
          createdAt: null,
          updatedAt: null,
          deletedAt: null,
        }) as LedgerEntryRow,
    );
}

describe("cell readers", () => {
  it("reads the date formats ledger exports use", () => {
    expect(parseSheetDate("07-May-2025")).toBe("2025-05-07");
    expect(parseSheetDate("7-May-25")).toBe("2025-05-07");
    expect(parseSheetDate("07 May 2025")).toBe("2025-05-07");
    expect(parseSheetDate("07/05/2025")).toBe("2025-05-07");
    expect(parseSheetDate("2025-05-07")).toBe("2025-05-07");
    expect(parseSheetDate("31-Feb-2025")).toBeNull();
    expect(parseSheetDate("tomorrow")).toBeNull();
  });

  it("reads amounts with Indian grouping and Dr/Cr balances", () => {
    expect(parseAmount("4,10,15,000.00")).toBe(41015000);
    expect(parseAmount("₹ 2000000")).toBe(2000000);
    expect(parseAmount("")).toBeNull();
    expect(parseBalance("5,000.00 Cr")).toBe(-5000);
    expect(parseBalance("5,000.00 Dr")).toBe(5000);
    expect(parseBalance("")).toBe(0);
    expect(parseBalance(null)).toBe(0);
  });
});

describe.each(Object.entries(GAF))("GAF %s", (name, rows) => {
  const analysis = analyzeSheet(rows);

  it("reads every row with nothing to stop posting", () => {
    expect(analysis.problems).toEqual([]);
    expect(analysis.rows.every((r) => r.ties)).toBe(true);
  });

  it("closes at zero on 6-Aug-2026, its last interest in August", () => {
    expect(analysis.closingBalance).toBe(0);
    expect(analysis.lastEntryDate).toBe("2026-08-06");
    expect(analysis.lastInterestMonth).toBe("2026-08-01");
  });

  it("posts entries the ledger reads back to the sheet's own balances", () => {
    const ledger = toLedgerRows(name, analysis.rows);
    analysis.rows
      .filter((r) => r.kind)
      .forEach((r, i) => {
        const snapshot = computeLoanSnapshot(ledger.slice(0, i + 1), r.entryDate!);
        expect(snapshot.closingBalance).toBeCloseTo(r.sheetBalance!, 2);
      });
    const final = computeLoanSnapshot(ledger, "2026-08-06");
    expect(final.totalPayable).toBe(0);
    expect(final.totalDisbursed).toBe(analysis.totals.disbursed);
    expect(final.totalInterest).toBe(analysis.totals.interest);
  });

  it("hands month-end interest back to the ledger only from September 2026", () => {
    expect(firstSystemAccrualMonth(analysis.firstEntryDate!.slice(0, 7) + "-01", analysis.lastInterestMonth)).toBe("2026-09-01");
  });
});

describe("refusals", () => {
  const base: SheetRowInput = {
    date: "01-Apr-2026",
    particulars: "Bank",
    vchType: "Payment",
    vchNo: "1",
    debit: "1000",
    credit: null,
    balance: "1000",
  };

  it("a balance that does not tie out", () => {
    const a = analyzeSheet([{ ...base, balance: "999" }]);
    expect(a.problems).toHaveLength(1);
    expect(a.problems[0]!.message).toMatch(/balance is 999/);
  });

  it("a voucher type the ledger does not record", () => {
    expect(analyzeSheet([{ ...base, vchType: "Contra" }]).problems[0]!.message).toMatch(/Contra/);
  });

  it("a payment on the credit side", () => {
    expect(analyzeSheet([{ ...base, debit: null, credit: "1000", balance: "1000 Cr" }]).problems[0]!.message).toMatch(/credit side/);
  });

  it("an opening balance line", () => {
    expect(analyzeSheet([{ ...base, particulars: "Opening Balance" }]).problems[0]!.message).toMatch(/opening balance/i);
  });

  it("rows out of date order", () => {
    const a = analyzeSheet([
      base,
      { ...base, date: "01-Mar-2026", vchNo: "2", balance: "2000" },
    ]);
    expect(a.problems[0]!.message).toMatch(/date order/);
  });

  it("but not the sheet's own totals line", () => {
    const a = analyzeSheet([base, { date: null, particulars: "15580143", vchType: null, vchNo: null, debit: null, credit: null, balance: null }]);
    expect(a.problems).toEqual([]);
    expect(a.rows).toHaveLength(1);
  });
});

describe("where the ledger takes over", () => {
  it("is the month after the last imported interest", () => {
    expect(firstSystemAccrualMonth("2025-05-01", "2026-06-01")).toBe("2026-07-01");
    expect(firstSystemAccrualMonth("2025-05-01", "2026-12-01")).toBe("2027-01-01");
  });

  it("is the first entry's month when nothing was imported", () => {
    expect(firstSystemAccrualMonth("2025-05-01", null)).toBe("2025-05-01");
  });
});
