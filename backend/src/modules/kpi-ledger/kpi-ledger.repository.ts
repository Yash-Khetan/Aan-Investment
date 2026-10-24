import { and, asc, desc, eq, gte, isNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db, kpiLedgerRows, ledgerEntries, ledgerImports, loans, users } from "../../db";
import { NotFoundError } from "../../common/errors";
import { getNextVchNo, type LedgerDbOrTx as DbOrTx } from "../ledger/ledger.repository";
import type { AnalyzedRow, SheetAnalysis } from "./sheet";
import type { ImportSheetInput, KpiLedgerRow, LedgerImportSummary } from "./kpi-ledger.types";

function toApiRow(row: typeof kpiLedgerRows.$inferSelect): KpiLedgerRow {
  return {
    id: row.id,
    rowIndex: row.rowIndex,
    importId: row.importId,
    sheetName: row.sheetName,
    date: row.entryDate,
    particulars: row.particulars,
    drCr: row.drCr,
    vchType: row.vchType,
    vchNo: row.vchNo,
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
  };
}

const notDeleted = (loanId: string) => and(eq(kpiLedgerRows.loanId, loanId), isNull(kpiLedgerRows.deletedAt));

/** The database's own clock, so a row's `locked_at` and its `created_at` can never disagree. */
const dbNow = sql`now()`;

export async function assertLoanExists(loanId: string): Promise<void> {
  const [row] = await db
    .select({ id: loans.id })
    .from(loans)
    .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError(`Loan ${loanId} not found.`);
}

const describeEntry = (e: { entryDate: string; vchType: string; source: string }) => {
  const what = { PAYMENT: "disbursement", RECEIPT: "receipt", JOURNAL_INTEREST: "interest entry", JOURNAL_TDS: "TDS entry" }[e.vchType] ?? "entry";
  const by = { MANUAL: "recorded by hand", SYSTEM: "posted by the ledger", IMPORT: "from an earlier import" }[e.source] ?? "";
  return `A ${what} on ${e.entryDate} (${by}).`;
};

/**
 * Ledger entries a sheet would clash with, described for the user. A sheet
 * can go in only where the ledger holds nothing of its own:
 *
 *   - nothing at all dated within the sheet's first and last dates;
 *   - nothing before it except earlier imported history (a manual or system
 *     entry before the sheet would sit in the middle of the history);
 *   - no month-end interest the ledger posted itself for a month the sheet
 *     already charges interest for.
 */
export async function findConflicts(loanId: string, analysis: SheetAnalysis): Promise<string[]> {
  if (!analysis.firstEntryDate || !analysis.lastEntryDate) return [];

  const clauses: SQL[] = [
    and(gte(ledgerEntries.entryDate, analysis.firstEntryDate), lte(ledgerEntries.entryDate, analysis.lastEntryDate))!,
    and(lt(ledgerEntries.entryDate, analysis.firstEntryDate), ne(ledgerEntries.source, "IMPORT"))!,
  ];
  if (analysis.lastInterestMonth) {
    clauses.push(
      and(
        eq(ledgerEntries.source, "SYSTEM"),
        eq(ledgerEntries.vchType, "JOURNAL_INTEREST"),
        lte(ledgerEntries.accrualMonth, analysis.lastInterestMonth),
      )!,
    );
  }

  const rows = await db
    .select({ entryDate: ledgerEntries.entryDate, vchType: ledgerEntries.vchType, source: ledgerEntries.source })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.loanId, loanId), or(...clauses)))
    .orderBy(asc(ledgerEntries.entryDate))
    .limit(10);

  return rows.map(describeEntry);
}

/** A date range as it reads in a message about an import. */
const describeRange = (from: string, to: string) => (from === to ? from : `${from} to ${to}`);

/**
 * Imports already posted to this loan that the sheet would duplicate,
 * described for the user. Posting needs this empty.
 *
 * Every row an import posts is locked, so nothing an import has already
 * posted can be overwritten or quietly replaced — a second upload of the same
 * history is refused outright rather than landing a second copy of it:
 *
 *   - any posted import whose date range overlaps this sheet's;
 *   - any posted import of the same file and sheet name, whatever its dates
 *     (the same workbook re-uploaded after a few rows were appended to it
 *     overlaps too, but this names it for what it is).
 *
 * This looks at `ledger_imports`, where `findConflicts` looks at the entries.
 * The two are complementary: an import whose entries were somehow removed
 * still blocks a re-upload here, and entries from any other source still
 * block one there.
 */
export async function findDuplicateImports(
  loanId: string,
  analysis: SheetAnalysis,
  sheet: ImportSheetInput,
): Promise<string[]> {
  if (!analysis.firstEntryDate || !analysis.lastEntryDate) return [];

  const overlaps = and(
    lte(ledgerImports.firstEntryDate, analysis.lastEntryDate),
    gte(ledgerImports.lastEntryDate, analysis.firstEntryDate),
  )!;

  const sameSheet =
    sheet.fileName && sheet.sheetName
      ? and(eq(ledgerImports.fileName, sheet.fileName), eq(ledgerImports.sheetName, sheet.sheetName))!
      : null;

  const rows = await db
    .select({
      fileName: ledgerImports.fileName,
      sheetName: ledgerImports.sheetName,
      rowCount: ledgerImports.rowCount,
      firstEntryDate: ledgerImports.firstEntryDate,
      lastEntryDate: ledgerImports.lastEntryDate,
      importedAt: ledgerImports.createdAt,
      isSameSheet: sameSheet ? sql<boolean>`(${sameSheet})` : sql<boolean>`false`,
    })
    .from(ledgerImports)
    .where(and(eq(ledgerImports.loanId, loanId), sameSheet ? or(overlaps, sameSheet) : overlaps))
    .orderBy(asc(ledgerImports.firstEntryDate))
    .limit(10);

  return rows.map((imp) => {
    const what = imp.isSameSheet
      ? `${imp.sheetName} in ${imp.fileName} has already been imported`
      : `An import${imp.fileName ? ` of ${imp.sheetName} in ${imp.fileName}` : ""} already covers ${describeRange(imp.firstEntryDate, imp.lastEntryDate)}`;
    const when = imp.importedAt ? ` on ${imp.importedAt.toISOString().slice(0, 10)}` : "";
    return `${what}${when} — ${imp.rowCount} rows, which are locked. Remove that import first, or import a sheet that starts after ${imp.lastEntryDate}.`;
  });
}

/**
 * Posts an analysed sheet in one transaction: the import record, the sheet's
 * rows exactly as sent, and one ledger entry per postable row with the sheet's
 * date and amount, in the sheet's order. Our own voucher numbers continue the
 * loan's sequence; the sheet's are kept beside them.
 *
 * Every ledger entry it posts is LOCKED as it is inserted — `locked_at` set by
 * the database's own clock, in the same transaction as the row itself. There
 * is no window in which an imported row exists unlocked, and no second pass
 * that could be interrupted and leave one that way. Returns the import's id
 * and how many entries it locked.
 */
export async function insertImport(input: {
  loanId: string;
  sheet: ImportSheetInput;
  analysis: SheetAnalysis;
  importedBy: string;
  /** Runs inside the import's own transaction — see kpi-ledger.service.ts. */
  onPosted?: (posted: { importId: string; lockedEntryCount: number }, tx: DbOrTx) => Promise<void>;
}): Promise<{ importId: string; lockedEntryCount: number }> {
  const { loanId, sheet, analysis } = input;

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(ledgerImports)
      .values({
        loanId,
        fileName: sheet.fileName ?? null,
        sheetName: sheet.sheetName ?? null,
        meta: sheet.meta ?? null,
        rowCount: analysis.rows.length,
        firstEntryDate: analysis.firstEntryDate!,
        lastEntryDate: analysis.lastEntryDate!,
        lastInterestMonth: analysis.lastInterestMonth,
        closingBalance: analysis.closingBalance.toFixed(2),
        importedBy: input.importedBy,
      })
      .returning({ id: ledgerImports.id });
    const importId = created!.id;

    // The raw rows, every one exactly as the sheet showed it.
    const [maxRow] = await tx
      .select({ maxIndex: sql<number | null>`max(${kpiLedgerRows.rowIndex})` })
      .from(kpiLedgerRows)
      .where(eq(kpiLedgerRows.loanId, loanId));
    let rowIndex = (maxRow?.maxIndex ?? -1) + 1;

    await tx.insert(kpiLedgerRows).values(
      sheet.rows.map((r) => ({
        loanId,
        importId,
        rowIndex: rowIndex++,
        sheetName: sheet.sheetName ?? null,
        entryDate: r.date,
        particulars: [r.particulars, r.narration].filter(Boolean).join(" — "),
        drCr: r.drCr ?? null,
        vchType: r.vchType,
        vchNo: r.vchNo,
        debit: r.debit,
        credit: r.credit,
        balance: r.balance,
        sourceFileName: sheet.fileName ?? null,
        sourceMeta: sheet.meta ?? null,
        importedBy: input.importedBy,
      })),
    );

    // The ledger entries, in sheet order — the insert order is the same-day order.
    let vchNo = Number(await getNextVchNo(loanId, tx));
    const postable = analysis.rows.filter((r): r is AnalyzedRow & { kind: NonNullable<AnalyzedRow["kind"]> } => r.kind !== null);
    for (const r of postable) {
      const isDebit = r.kind === "PAYMENT" || r.kind === "JOURNAL_INTEREST";
      const isJournal = r.kind === "JOURNAL_INTEREST" || r.kind === "JOURNAL_TDS";
      await tx.insert(ledgerEntries).values({
        loanId,
        entryDate: r.entryDate!,
        narration: r.narration,
        vchType: r.kind,
        vchNo: String(vchNo++),
        debit: isDebit ? r.amount!.toFixed(2) : null,
        credit: isDebit ? null : r.amount!.toFixed(2),
        accrualMonth: isJournal ? `${r.entryDate!.slice(0, 7)}-01` : null,
        isSystemGenerated: false,
        source: "IMPORT",
        importId,
        sourceVchType: r.sourceVchType,
        sourceVchNo: r.sourceVchNo,
        // Imported, therefore locked — in the same statement that posts it.
        lockedAt: dbNow,
      });
    }

    const posted = { importId, lockedEntryCount: postable.length };
    // The audit row goes in here, so a committed import is always a recorded one.
    await input.onPosted?.(posted, tx);

    return posted;
  });
}

export async function listImports(loanId: string): Promise<LedgerImportSummary[]> {
  const rows = await db
    .select({
      id: ledgerImports.id,
      fileName: ledgerImports.fileName,
      sheetName: ledgerImports.sheetName,
      meta: ledgerImports.meta,
      rowCount: ledgerImports.rowCount,
      firstEntryDate: ledgerImports.firstEntryDate,
      lastEntryDate: ledgerImports.lastEntryDate,
      lastInterestMonth: ledgerImports.lastInterestMonth,
      closingBalance: ledgerImports.closingBalance,
      importedByName: sql<string | null>`case when ${users.id} is null then null else trim(concat(${users.firstName}, ' ', coalesce(${users.lastName}, ''))) end`,
      importedAt: ledgerImports.createdAt,
    })
    .from(ledgerImports)
    .leftJoin(users, eq(ledgerImports.importedBy, users.id))
    .where(eq(ledgerImports.loanId, loanId))
    .orderBy(desc(ledgerImports.firstEntryDate));
  return rows;
}

/**
 * Removes an import and — by cascade — every ledger entry and raw row it
 * posted. This is the one path that takes locked entries out of a ledger:
 * they go as a whole import, never one row at a time.
 *
 * `onDeleted` runs inside the same transaction (the audit row — see
 * kpi-ledger.service.ts), so the removal and its trail entry commit together.
 */
export async function deleteImport(
  loanId: string,
  importId: string,
  onDeleted?: (removed: typeof ledgerImports.$inferSelect, tx: DbOrTx) => Promise<void>,
): Promise<typeof ledgerImports.$inferSelect> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .delete(ledgerImports)
      .where(and(eq(ledgerImports.id, importId), eq(ledgerImports.loanId, loanId)))
      .returning();
    if (!row) throw new NotFoundError(`Import ${importId} not found for loan ${loanId}.`);

    await onDeleted?.(row, tx);
    return row;
  });
}

/** Page through one loan's imported rows in sheet order. */
export async function listPaginated(
  loanId: string,
  page: number,
  limit: number,
): Promise<{ rows: KpiLedgerRow[]; total: number }> {
  const rows = await db
    .select()
    .from(kpiLedgerRows)
    .where(notDeleted(loanId))
    .orderBy(asc(kpiLedgerRows.rowIndex))
    .limit(limit)
    .offset((page - 1) * limit);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(kpiLedgerRows)
    .where(notDeleted(loanId));

  return { rows: rows.map(toApiRow), total: countRow?.total ?? 0 };
}
