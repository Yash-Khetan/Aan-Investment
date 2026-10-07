import { BadRequestError } from "../../common/errors";
import { recomputeMonthsFrom } from "../ledger/ledger.service";
import { syncLoanStatusWithLedger } from "../ledger/loanStatus";
import {
  assertLoanExists,
  deleteImport,
  findConflicts,
  insertImport,
  listImports,
  listPaginated,
} from "./kpi-ledger.repository";
import { analyzeSheet } from "./sheet";
import type {
  ImportPreview,
  ImportSheetInput,
  LedgerImportSummary,
  PaginatedKpiLedgerRows,
} from "./kpi-ledger.types";

/** Parses an ISO date the way the ledger does — local calendar day. */
function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/**
 * What posting this sheet into the loan's ledger would do: every row read,
 * its balance checked against the sheet's, and anything in the ledger it
 * would clash with. Writes nothing.
 */
export async function previewImport(loanId: string, sheet: ImportSheetInput): Promise<ImportPreview> {
  await assertLoanExists(loanId);
  const analysis = analyzeSheet(sheet.rows);
  const conflicts = await findConflicts(loanId, analysis);
  return { ...analysis, conflicts, canPost: analysis.problems.length === 0 && conflicts.length === 0 };
}

/**
 * Posts a sheet into the loan's ledger — only when every row reads and ties
 * out to the sheet's own balance, and nothing in the ledger clashes with it.
 *
 * Afterwards, the ledger's own month-end interest for months after the
 * history is recalculated, since the balance it accrued on now starts from
 * the imported history. The imported entries themselves are never
 * recalculated. The loan then closes if the history paid it off.
 */
export async function postImport(
  loanId: string,
  sheet: ImportSheetInput,
  importedBy: string,
): Promise<{ importId: string; preview: ImportPreview; loanStatus: string | null }> {
  const preview = await previewImport(loanId, sheet);
  if (!preview.canPost) {
    throw new BadRequestError("This sheet cannot be posted until every problem is fixed.", {
      problems: preview.problems,
      conflicts: preview.conflicts,
    });
  }

  const importId = await insertImport({ loanId, sheet, analysis: preview, importedBy });

  await recomputeMonthsFrom(loanId, localDate(preview.firstEntryDate!));
  const loanStatus = await syncLoanStatusWithLedger(loanId);

  return { importId, preview, loanStatus };
}

/**
 * Removes an import and everything it posted, then recalculates the ledger's
 * own month-end interest from where the history began and re-checks whether
 * the loan is still closed.
 */
export async function removeImport(loanId: string, importId: string): Promise<{ loanStatus: string | null }> {
  await assertLoanExists(loanId);
  const firstEntryDate = await deleteImport(loanId, importId);
  await recomputeMonthsFrom(loanId, localDate(firstEntryDate));
  const loanStatus = await syncLoanStatusWithLedger(loanId);
  return { loanStatus };
}

export async function getImports(loanId: string): Promise<LedgerImportSummary[]> {
  await assertLoanExists(loanId);
  return listImports(loanId);
}

export async function getLedgerPage(loanId: string, page: number, limit: number): Promise<PaginatedKpiLedgerRows> {
  await assertLoanExists(loanId);
  const { rows, total } = await listPaginated(loanId, page, limit);
  return { rows, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
