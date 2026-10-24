import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, asc, eq, sql } from "drizzle-orm";

/**
 * The ledger's locking and editing rules, against a real Postgres migrated
 * with the project's own migrations (src/test/testDb.ts). The application's
 * single pool is redirected to it, so every repository, service and SQL
 * guard below is the one that runs in production.
 *
 * Two things this reaches that a mock could not: the WHERE clauses that make
 * a locked row unreachable, and the unique index that makes month-end posting
 * idempotent.
 *
 * "Today" is frozen, because the ledger generates month-end journals up to
 * the last fully elapsed month: with 15-Jun-2024 as today, a loan whose
 * history ends in January 2024 gets exactly the four pairs February to May.
 */

vi.mock("../../db", async () => {
  const { mockDbModule } = await import("../../test/testDb");
  return mockDbModule();
});

import { auditLogs, ledgerEntries } from "../../db/schema";
import { grantPermissions, seedLoan } from "../../test/seed";
import { migrateTestDb, testDb } from "../../test/testDb";
import { authorizationService } from "../auth/authorization.service";
import { postImport, previewImport, removeImport } from "../kpi-ledger/kpi-ledger.service";
import type { ImportSheetInput } from "../kpi-ledger/kpi-ledger.types";
import { LOCKED_REASON, SYSTEM_REASON } from "./entryRules";
import {
  deleteManualEntry,
  getEntriesForLoan,
  updateManualEntry,
  type LedgerEntryRow,
} from "./ledger.repository";
import {
  deleteLedgerEntry,
  getLoanLedger,
  recordPaymentOrReceipt,
  syncMissingMonthEndJournals,
  updateLedgerEntry,
} from "./ledger.service";
import { updateEntrySchema } from "./ledger.validators";

const TODAY = new Date(2024, 5, 15, 12, 0, 0);

const ACTOR = { userId: "", ipAddress: "10.0.0.1", userAgent: "vitest" };

/**
 * A client's own ledger sheet: a disbursement and January's interest/TDS
 * pair, each row carrying the balance the client's system printed beside it.
 */
function historySheet(): ImportSheetInput {
  return {
    fileName: "client-history.xlsx",
    sheetName: "Loan A",
    meta: "Ledger Account · 1-Jan-2024 to 31-Jan-2024",
    rows: [
      {
        date: "01-Jan-2024",
        particulars: "Bank",
        narration: "Disbursed",
        drCr: "Dr",
        vchType: "Payment",
        vchNo: "1",
        debit: "1000000.00",
        credit: null,
        balance: "1000000.00",
      },
      {
        date: "31-Jan-2024",
        particulars: "Interest",
        narration: "Being Interest @ 21%",
        drCr: "Dr",
        vchType: "Journal",
        vchNo: "2",
        debit: "17260.27",
        credit: null,
        balance: "1017260.27",
      },
      {
        date: "31-Jan-2024",
        particulars: "Tds",
        narration: "Being Tds @ 10%",
        drCr: "Cr",
        vchType: "Journal",
        vchNo: "3",
        debit: null,
        credit: "1726.03",
        balance: "1015534.24",
      },
    ],
  };
}

/** The sheet's closing balance: 1,000,000 + 17,260.27 − 1,726.03. */
const SHEET_CLOSING_BALANCE = 1015534.24;

async function entriesFrom(loanId: string, source: "MANUAL" | "SYSTEM" | "IMPORT"): Promise<LedgerEntryRow[]> {
  return testDb
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.loanId, loanId), eq(ledgerEntries.source, source)))
    .orderBy(asc(ledgerEntries.entryDate), asc(ledgerEntries.sequenceNo));
}

async function auditRowsFor(entityId: string) {
  return testDb.select().from(auditLogs).where(eq(auditLogs.entityId, entityId));
}

/** The month-end pairs the ledger posted itself, stripped of what is unique to one loan. */
function journalShape(entries: LedgerEntryRow[]) {
  return entries
    .filter((e) => e.source === "SYSTEM")
    .map((e) => ({
      accrualMonth: e.accrualMonth,
      vchType: e.vchType,
      entryDate: e.entryDate,
      debit: e.debit,
      credit: e.credit,
      ratePercent: e.ratePercent,
      interestBasis: e.interestBasis,
      includeOpeningClosingDays: e.includeOpeningClosingDays,
      narration: e.narration,
    }));
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  await migrateTestDb();
});

afterAll(() => {
  vi.useRealTimers();
});

/* ============================================================
   1. AN IMPORT LOCKS WHAT IT POSTS
============================================================ */

describe("importing a sheet", () => {
  let loanId: string;
  let userId: string;
  let importId: string;
  let imported: LedgerEntryRow[];

  beforeAll(async () => {
    const seeded = await seedLoan({ effectiveFrom: "2024-01-01" });
    loanId = seeded.loanId;
    userId = seeded.userId;

    const result = await postImport(loanId, historySheet(), { ...ACTOR, userId });
    importId = result.importId;
    imported = await entriesFrom(loanId, "IMPORT");
  });

  it("posts one entry per sheet row and locks every one of them", async () => {
    expect(imported).toHaveLength(3);
    expect(imported.every((e) => e.lockedAt !== null)).toBe(true);
    expect(imported.every((e) => e.importId === importId)).toBe(true);
    expect(imported.map((e) => [e.vchType, e.debit, e.credit])).toEqual([
      ["PAYMENT", "1000000.00", null],
      ["JOURNAL_INTEREST", "17260.27", null],
      ["JOURNAL_TDS", null, "1726.03"],
    ]);
  });

  it("reports the lock, and the reason, on the ledger read", async () => {
    const { entries } = await getLoanLedger(loanId);
    const importedRows = entries.filter((e) => e.source === "IMPORT");

    expect(importedRows).toHaveLength(3);
    for (const row of importedRows) {
      expect(row.isLocked).toBe(true);
      expect(row.isEditable).toBe(false);
      expect(row.lockReason).toBe(LOCKED_REASON);
      expect(row.lockedAt).not.toBeNull();
    }
  });

  it("still reads as locked on a later, independent read — the lock is a stored column", async () => {
    const [row] = await testDb
      .select({ lockedAt: ledgerEntries.lockedAt, source: ledgerEntries.source })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.id, imported[0]!.id));

    expect(row!.source).toBe("IMPORT");
    expect(row!.lockedAt).not.toBeNull();
  });

  it("leaves the imported figures as the record of the balance — locking changes no figure", async () => {
    const { entries } = await getLoanLedger(loanId);
    const lastImported = [...entries].reverse().find((e) => e.source === "IMPORT")!;

    expect(lastImported.balance).toBeCloseTo(SHEET_CLOSING_BALANCE, 2);
  });

  it("takes over month-end interest only from the month after the sheet's last interest", async () => {
    const system = await entriesFrom(loanId, "SYSTEM");

    expect([...new Set(system.map((e) => e.accrualMonth))]).toEqual([
      "2024-02-01",
      "2024-03-01",
      "2024-04-01",
      "2024-05-01",
    ]);
  });

  it("records the import in the audit trail, with the file and the rows it locked", async () => {
    const trail = await auditRowsFor(importId);

    expect(trail).toHaveLength(1);
    expect(trail[0]!.action).toBe("CREATE");
    expect(trail[0]!.entityType).toBe("LEDGER_IMPORT");
    expect(trail[0]!.userId).toBe(userId);
    expect(trail[0]!.ipAddress).toBe("10.0.0.1");
    expect(trail[0]!.newValues).toMatchObject({
      fileName: "client-history.xlsx",
      sheetName: "Loan A",
      locked: true,
      lockedEntryCount: 3,
      firstEntryDate: "2024-01-01",
      lastEntryDate: "2024-01-31",
    });
  });

  /* ---------- a locked entry is refused, from any direction ---------- */

  it("refuses to edit a locked entry, and writes nothing", async () => {
    const target = imported[0]!;

    await expect(
      updateLedgerEntry({
        loanId,
        entryId: target.id,
        patch: { amount: 9999999 },
        actor: { ...ACTOR, userId },
      }),
    ).rejects.toThrow(LOCKED_REASON);

    const [after] = await testDb.select().from(ledgerEntries).where(eq(ledgerEntries.id, target.id));
    expect(after!.debit).toBe("1000000.00");
    expect(after!.lockedAt).not.toBeNull();
    expect(await auditRowsFor(target.id)).toHaveLength(0);
  });

  it("refuses to delete a locked entry, and writes nothing", async () => {
    const target = imported[1]!;

    await expect(
      deleteLedgerEntry({ loanId, entryId: target.id, actor: { ...ACTOR, userId } }),
    ).rejects.toThrow(LOCKED_REASON);

    expect(await entriesFrom(loanId, "IMPORT")).toHaveLength(3);
    expect(await auditRowsFor(target.id)).toHaveLength(0);
  });

  it("is unreachable even for a caller that skips the service — the WHERE clause refuses it", async () => {
    const target = imported[0]!;

    const updated = await updateManualEntry(target.id, {
      entryDate: "2024-05-05",
      vchType: "RECEIPT",
      debit: null,
      credit: "1.00",
      narration: "tampered",
    });
    const deleted = await deleteManualEntry(target.id);

    expect(updated).toBeNull();
    expect(deleted).toBeNull();

    const [after] = await testDb.select().from(ledgerEntries).where(eq(ledgerEntries.id, target.id));
    expect([after!.entryDate, after!.vchType, after!.debit, after!.credit]).toEqual([
      "2024-01-01",
      "PAYMENT",
      "1000000.00",
      null,
    ]);
  });

  /* ---------- a second upload cannot overwrite it ---------- */

  it("refuses a second upload of the same sheet, and leaves the locked rows exactly as they were", async () => {
    const before = await entriesFrom(loanId, "IMPORT");

    const preview = await previewImport(loanId, historySheet());
    expect(preview.canPost).toBe(false);
    expect(preview.duplicates.join(" ")).toContain("has already been imported");
    expect(preview.duplicates.join(" ")).toContain("locked");

    await expect(postImport(loanId, historySheet(), { ...ACTOR, userId })).rejects.toThrow(
      "cannot be posted until every problem is fixed",
    );

    const after = await entriesFrom(loanId, "IMPORT");
    expect(after.map((e) => [e.id, e.entryDate, e.debit, e.credit])).toEqual(
      before.map((e) => [e.id, e.entryDate, e.debit, e.credit]),
    );
  });

  it("refuses a different sheet that overlaps the locked history", async () => {
    const overlapping: ImportSheetInput = {
      fileName: "another-file.xlsx",
      sheetName: "Second extract",
      meta: null,
      rows: [
        {
          date: "15-Jan-2024",
          particulars: "Bank",
          narration: "Disbursed again",
          drCr: "Dr",
          vchType: "Payment",
          vchNo: "7",
          debit: "500.00",
          credit: null,
          balance: "500.00",
        },
      ],
    };

    const preview = await previewImport(loanId, overlapping);
    expect(preview.canPost).toBe(false);
    expect(preview.duplicates.join(" ")).toContain("already covers 2024-01-01 to 2024-01-31");
  });

  /* ---------- an entry recorded by hand after the history ---------- */

  it("lets a hand-recorded entry after the history be edited, and keeps the imported rows untouched", async () => {
    const importedBefore = await entriesFrom(loanId, "IMPORT");

    const receipt = await recordPaymentOrReceipt({
      loanId,
      entryDate: "2024-03-05",
      vchType: "RECEIPT",
      amount: 100000,
      narration: "Part payment",
    });

    const updated = await updateLedgerEntry({
      loanId,
      entryId: receipt.id,
      patch: { amount: 150000, narration: "Part payment (revised)" },
      actor: { ...ACTOR, userId },
    });

    expect(updated.credit).toBe("150000.00");

    const [persisted] = await testDb.select().from(ledgerEntries).where(eq(ledgerEntries.id, receipt.id));
    expect(persisted!.credit).toBe("150000.00");
    expect(persisted!.narration).toBe("Part payment (revised)");
    expect(persisted!.vchNo).toBe(receipt.vchNo);
    expect(persisted!.lockedAt).toBeNull();

    // The imported rows are the sheet's own figures and are never recalculated.
    const importedAfter = await entriesFrom(loanId, "IMPORT");
    expect(importedAfter.map((e) => [e.debit, e.credit, e.narration, e.lockedAt?.toISOString()])).toEqual(
      importedBefore.map((e) => [e.debit, e.credit, e.narration, e.lockedAt?.toISOString()]),
    );
  });

  it("refuses to move a hand-recorded entry back into the imported history", async () => {
    const [receipt] = await entriesFrom(loanId, "MANUAL");

    await expect(
      updateLedgerEntry({
        loanId,
        entryId: receipt!.id,
        patch: { entryDate: "2024-01-15" },
        actor: { ...ACTOR, userId },
      }),
    ).rejects.toThrow("imported history runs to 2024-01-31");

    const [unchanged] = await testDb.select().from(ledgerEntries).where(eq(ledgerEntries.id, receipt!.id));
    expect(unchanged!.entryDate).toBe("2024-03-05");
  });

  it("refuses to edit a month-end journal the ledger posted itself", async () => {
    const [journal] = await entriesFrom(loanId, "SYSTEM");

    await expect(
      updateLedgerEntry({
        loanId,
        entryId: journal!.id,
        patch: { amount: 1 },
        actor: { ...ACTOR, userId },
      }),
    ).rejects.toThrow(SYSTEM_REASON);
  });

  it("posts each month's Interest/TDS pair exactly once, however often it is asked to", async () => {
    const before = await getEntriesForLoan(loanId);

    await syncMissingMonthEndJournals(loanId);
    await syncMissingMonthEndJournals(loanId);

    const after = await getEntriesForLoan(loanId);
    expect(after).toHaveLength(before.length);

    const duplicated = await testDb
      .select({ accrualMonth: ledgerEntries.accrualMonth, vchType: ledgerEntries.vchType, total: sql<number>`count(*)::int` })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.loanId, loanId), eq(ledgerEntries.source, "SYSTEM")))
      .groupBy(ledgerEntries.accrualMonth, ledgerEntries.vchType)
      .having(sql`count(*) > 1`);

    expect(duplicated).toEqual([]);
  });

  /* ---------- removing the whole import is the way back ---------- */

  it("removes locked entries only with their import, records that, and frees the period again", async () => {
    await removeImport(loanId, importId, { ...ACTOR, userId });

    expect(await entriesFrom(loanId, "IMPORT")).toHaveLength(0);
    // The hand-recorded receipt was never the import's to take.
    expect(await entriesFrom(loanId, "MANUAL")).toHaveLength(1);

    const trail = await auditRowsFor(importId);
    expect(trail.map((row) => row.action).sort()).toEqual(["CREATE", "DELETE"]);
    expect(trail.find((row) => row.action === "DELETE")!.oldValues).toMatchObject({
      fileName: "client-history.xlsx",
      rowCount: 3,
    });

    const preview = await previewImport(loanId, historySheet());
    expect(preview.duplicates).toEqual([]);
    expect(preview.canPost).toBe(true);
  });
});

/* ============================================================
   2. EDITING A HAND-RECORDED ENTRY
============================================================ */

describe("editing a hand-recorded entry", () => {
  let loanId: string;
  let userId: string;
  let paymentId: string;

  beforeAll(async () => {
    const seeded = await seedLoan({ effectiveFrom: "2024-01-01" });
    loanId = seeded.loanId;
    userId = seeded.userId;

    const payment = await recordPaymentOrReceipt({
      loanId,
      entryDate: "2024-01-01",
      vchType: "PAYMENT",
      amount: 1000000,
      narration: "Disbursement",
    });
    paymentId = payment.id;
    await syncMissingMonthEndJournals(loanId);
  });

  it("offers the edit on the ledger read", async () => {
    const { entries } = await getLoanLedger(loanId);
    const payment = entries.find((e) => e.id === paymentId)!;

    expect(payment.isEditable).toBe(true);
    expect(payment.isLocked).toBe(false);
    expect(payment.lockReason).toBeNull();
    expect(entries.filter((e) => e.source === "SYSTEM").every((e) => e.isEditable)).toBe(false);
  });

  it("persists every permitted field", async () => {
    await updateLedgerEntry({
      loanId,
      entryId: paymentId,
      patch: { entryDate: "2024-01-02", amount: 1200000, narration: "Disbursement (corrected)" },
      actor: { ...ACTOR, userId },
    });

    const [persisted] = await testDb.select().from(ledgerEntries).where(eq(ledgerEntries.id, paymentId));
    expect(persisted!.entryDate).toBe("2024-01-02");
    expect(persisted!.debit).toBe("1200000.00");
    expect(persisted!.credit).toBeNull();
    expect(persisted!.narration).toBe("Disbursement (corrected)");
    expect(persisted!.source).toBe("MANUAL");
  });

  it("moves the amount to the other side when the type changes, and back again", async () => {
    await updateLedgerEntry({
      loanId,
      entryId: paymentId,
      patch: { vchType: "RECEIPT" },
      actor: { ...ACTOR, userId },
    });

    const [asReceipt] = await testDb.select().from(ledgerEntries).where(eq(ledgerEntries.id, paymentId));
    expect([asReceipt!.vchType, asReceipt!.debit, asReceipt!.credit]).toEqual(["RECEIPT", null, "1200000.00"]);

    await updateLedgerEntry({
      loanId,
      entryId: paymentId,
      patch: { vchType: "PAYMENT" },
      actor: { ...ACTOR, userId },
    });

    const [asPayment] = await testDb.select().from(ledgerEntries).where(eq(ledgerEntries.id, paymentId));
    expect([asPayment!.vchType, asPayment!.debit, asPayment!.credit]).toEqual(["PAYMENT", "1200000.00", null]);
  });

  it("records each edit in the audit trail, with only the fields that moved", async () => {
    const trail = await auditRowsFor(paymentId);
    const first = trail.find((row) => (row.newValues as Record<string, unknown>).amount === 1200000)!;

    expect(first.action).toBe("UPDATE");
    expect(first.entityType).toBe("LEDGER_ENTRY");
    expect(first.userId).toBe(userId);
    expect(first.oldValues).toMatchObject({ amount: 1000000, entryDate: "2024-01-01", loanId });
    expect(first.newValues).toMatchObject({ amount: 1200000, entryDate: "2024-01-02" });
    // The narration moved too, but nothing that did not.
    expect(Object.keys(first.newValues as object).sort()).toEqual(["amount", "entryDate", "narration"]);
  });

  it("writes nothing at all when the patch changes nothing", async () => {
    const trailBefore = await auditRowsFor(paymentId);

    const unchanged = await updateLedgerEntry({
      loanId,
      entryId: paymentId,
      patch: { amount: 1200000, vchType: "PAYMENT" },
      actor: { ...ACTOR, userId },
    });

    expect(unchanged.debit).toBe("1200000.00");
    expect(await auditRowsFor(paymentId)).toHaveLength(trailBefore.length);
  });

  it("refuses an entry id from another loan", async () => {
    const other = await seedLoan({ effectiveFrom: "2024-01-01" });

    await expect(
      updateLedgerEntry({
        loanId: other.loanId,
        entryId: paymentId,
        patch: { amount: 5 },
        actor: { ...ACTOR, userId },
      }),
    ).rejects.toThrow("was not found on loan");
  });

  it("removes a hand-recorded entry, and records that too", async () => {
    const receipt = await recordPaymentOrReceipt({
      loanId,
      entryDate: "2024-04-10",
      vchType: "RECEIPT",
      amount: 25000,
    });

    await deleteLedgerEntry({ loanId, entryId: receipt.id, actor: { ...ACTOR, userId } });

    const gone = await testDb.select().from(ledgerEntries).where(eq(ledgerEntries.id, receipt.id));
    expect(gone).toHaveLength(0);

    const trail = await auditRowsFor(receipt.id);
    expect(trail).toHaveLength(1);
    expect(trail[0]!.action).toBe("DELETE");
    expect(trail[0]!.oldValues).toMatchObject({ amount: 25000, vchType: "RECEIPT", entryDate: "2024-04-10" });
    expect(trail[0]!.newValues).toBeNull();
  });
});

/* ============================================================
   3. THE FIGURES AFTER AN EDIT

   An edited entry must leave the loan exactly as it would have
   been had the corrected figure been recorded in the first
   place — and must leave every posted month's own snapshot of
   what it accrued under alone.
============================================================ */

describe("the figures after an edit", () => {
  let edited: { loanId: string; userId: string; paymentId: string };
  let recordedDirectly: { loanId: string };

  beforeAll(async () => {
    const a = await seedLoan({ effectiveFrom: "2024-01-01" });
    const payment = await recordPaymentOrReceipt({
      loanId: a.loanId,
      entryDate: "2024-01-01",
      vchType: "PAYMENT",
      amount: 1000000,
    });
    await syncMissingMonthEndJournals(a.loanId);
    await recordPaymentOrReceipt({
      loanId: a.loanId,
      entryDate: "2024-03-20",
      vchType: "RECEIPT",
      amount: 40000,
    });
    edited = { loanId: a.loanId, userId: a.userId, paymentId: payment.id };

    const b = await seedLoan({ effectiveFrom: "2024-01-01" });
    await recordPaymentOrReceipt({
      loanId: b.loanId,
      entryDate: "2024-01-01",
      vchType: "PAYMENT",
      amount: 2000000,
    });
    await recordPaymentOrReceipt({
      loanId: b.loanId,
      entryDate: "2024-03-20",
      vchType: "RECEIPT",
      amount: 40000,
    });
    await syncMissingMonthEndJournals(b.loanId);
    recordedDirectly = { loanId: b.loanId };
  });

  it("leaves the same ledger as recording the corrected figure would have", async () => {
    const before = journalShape(await getEntriesForLoan(edited.loanId));

    await updateLedgerEntry({
      loanId: edited.loanId,
      entryId: edited.paymentId,
      patch: { amount: 2000000 },
      actor: { ...ACTOR, userId: edited.userId },
    });

    const after = journalShape(await getEntriesForLoan(edited.loanId));
    const reference = journalShape(await getEntriesForLoan(recordedDirectly.loanId));

    // The edit moved the figures...
    expect(after).not.toEqual(before);
    // ...to exactly the ones the same ledger recorded from the start.
    expect(after).toEqual(reference);
  });

  it("leaves the same closing balance, and one that still ties to its bifurcation", async () => {
    const edit = await getLoanLedger(edited.loanId);
    const reference = await getLoanLedger(recordedDirectly.loanId);

    const closingOf = (ledger: Awaited<ReturnType<typeof getLoanLedger>>) => ledger.entries[ledger.entries.length - 1]!;

    expect(closingOf(edit).balance).toBeCloseTo(closingOf(reference).balance, 2);

    const closing = closingOf(edit);
    const parts =
      closing.bifurcation.principal + closing.bifurcation.interest.reduce((sum, m) => sum + m.amount, 0);
    expect(parts).toBeCloseTo(closing.balance, 2);
  });

  it("keeps every posted month's rate, basis and day-count snapshot as it was", async () => {
    const journals = (await getEntriesForLoan(edited.loanId)).filter((e) => e.source === "SYSTEM");

    expect(journals.length).toBeGreaterThan(0);
    for (const journal of journals) {
      expect(journal.interestBasis).toBe("ACTUAL_365");
      expect(journal.includeOpeningClosingDays).toBe(false);
      expect(journal.ratePercent).toBe(journal.vchType === "JOURNAL_INTEREST" ? "21.00" : "10.00");
    }

    const tds = journals.filter((e) => e.vchType === "JOURNAL_TDS");
    const interest = journals.filter((e) => e.vchType === "JOURNAL_INTEREST");
    expect(tds).toHaveLength(interest.length);

    // Each month's TDS is still 10% of that month's interest, to the paisa.
    for (const month of interest) {
      const pair = tds.find((t) => t.accrualMonth === month.accrualMonth)!;
      expect(Number(pair.credit)).toBeCloseTo(Math.round(Number(month.debit) * 10) / 100, 2);
    }
  });

  it("adds no month-end journal and duplicates none", async () => {
    const months = (await getEntriesForLoan(edited.loanId))
      .filter((e) => e.source === "SYSTEM" && e.vchType === "JOURNAL_INTEREST")
      .map((e) => e.accrualMonth);

    expect(months).toEqual(["2024-01-01", "2024-02-01", "2024-03-01", "2024-04-01", "2024-05-01"]);
    expect(new Set(months).size).toBe(months.length);
  });
});

/* ============================================================
   4. WHAT IS REFUSED BEFORE IT REACHES THE LEDGER
============================================================ */

describe("validation", () => {
  it("refuses a patch that changes nothing", () => {
    expect(updateEntrySchema.safeParse({}).success).toBe(false);
  });

  it("refuses an amount that is not a positive number", () => {
    expect(updateEntrySchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(updateEntrySchema.safeParse({ amount: -100 }).success).toBe(false);
    expect(updateEntrySchema.safeParse({ amount: "abc" }).success).toBe(false);
  });

  it("refuses a date that is not a calendar date, and a type that is not a Payment or Receipt", () => {
    expect(updateEntrySchema.safeParse({ entryDate: "31/01/2024" }).success).toBe(false);
    expect(updateEntrySchema.safeParse({ entryDate: "2024-02-31" }).success).toBe(false);
    expect(updateEntrySchema.safeParse({ vchType: "JOURNAL_INTEREST" }).success).toBe(false);
  });

  it("drops every field that is derived or system-managed", () => {
    const parsed = updateEntrySchema.parse({
      amount: 500,
      debit: "999999",
      credit: "999999",
      vchNo: "1",
      source: "MANUAL",
      importId: "11111111-1111-4111-8111-111111111111",
      lockedAt: null,
      ratePercent: "99",
      interestBasis: "ACTUAL_360",
      accrualMonth: "2024-01-01",
      isSystemGenerated: false,
      sequenceNo: 1,
      loanId: "11111111-1111-4111-8111-111111111111",
    });

    expect(parsed).toEqual({ amount: 500 });
  });

  it("accepts a cleared narration", () => {
    expect(updateEntrySchema.safeParse({ narration: null }).success).toBe(true);
    expect(updateEntrySchema.safeParse({ narration: "" }).success).toBe(true);
  });
});

/* ============================================================
   5. WHO MAY EDIT

   The editing routes carry authorize("loan:update") — the grant
   the Loan module's own edit route carries. This is the verdict
   that middleware reads, against the real permission graph.
============================================================ */

describe("permission to edit", () => {
  it("is held by a user granted loan:update, and by nobody else", async () => {
    const permitted = await seedLoan();
    const refused = await seedLoan();

    await grantPermissions(permitted.userId, "LEDGER_EDITOR", ["loan:read", "loan:update"]);
    await grantPermissions(refused.userId, "LEDGER_VIEWER", ["loan:read"]);

    expect(await authorizationService.hasAllPermissions(permitted.userId, ["loan:update"])).toBe(true);
    expect(await authorizationService.hasAllPermissions(refused.userId, ["loan:update"])).toBe(false);
  });
});
