import { and, asc, desc, eq, gte, isNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db, kpiLedgerRows, ledgerEntries, ledgerImports, loans, users } from "../../db";
import { NotFoundError } from "../../common/errors";
import { getNextVchNo } from "../ledger/ledger.repository";
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

/**
 * Posts an analysed sheet in one transaction: the import record, the sheet's
 * rows exactly as sent, and one ledger entry per postable row with the sheet's
 * date and amount, in the sheet's order. Our own voucher numbers continue the
 * loan's sequence; the sheet's are kept beside them.
 */
export async function insertImport(input: {
  loanId: string;
  sheet: ImportSheetInput;
  analysis: SheetAnalysis;
  importedBy: string;
}): Promise<string> {
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
      });
    }

    return importId;
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

/** Removes an import and — by cascade — every ledger entry and raw row it posted. Returns its first date. */
export async function deleteImport(loanId: string, importId: string): Promise<string> {
  const [row] = await db
    .delete(ledgerImports)
    .where(and(eq(ledgerImports.id, importId), eq(ledgerImports.loanId, loanId)))
    .returning({ firstEntryDate: ledgerImports.firstEntryDate });
  if (!row) throw new NotFoundError(`Import ${importId} not found for loan ${loanId}.`);
  return row.firstEntryDate;
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
