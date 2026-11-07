import { BadRequestError } from "../../common/errors";
import { AUDIT_ENTITY } from "../audit/audit.constants";
import { recordAudit } from "../audit/audit.service";
import type { AuditActor } from "../audit/audit.types";
import { recomputeMonthsFrom } from "../ledger/ledger.service";
import { syncLoanStatusWithLedger } from "../ledger/loanStatus";
import type { RequestActor } from "../../common/http/actor";
import { registerApplier, submitChangeRequest } from "../change-request/change-request.service";
import { CHANGE_REQUEST_ENTITY } from "../change-request/change-request.constants";
import {
  assertLoanExists,
  deleteImport,
  findConflicts,
  findDuplicateImports,
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
 * its balance checked against the sheet's, anything in the ledger it would
 * clash with, and any import already posted that it would duplicate. Writes
 * nothing.
 */
export async function previewImport(loanId: string, sheet: ImportSheetInput): Promise<ImportPreview> {
  await assertLoanExists(loanId);
  const analysis = analyzeSheet(sheet.rows);
  const [conflicts, duplicates] = await Promise.all([
    findConflicts(loanId, analysis),
    findDuplicateImports(loanId, analysis, sheet),
  ]);
  return {
    ...analysis,
    conflicts,
    duplicates,
    canPost: analysis.problems.length === 0 && conflicts.length === 0 && duplicates.length === 0,
  };
}

/**
 * Posts a sheet into the loan's ledger — only when every row reads and ties
 * out to the sheet's own balance, nothing in the ledger clashes with it, and
 * no import already posted covers the same history.
 *
 * Every entry it posts is LOCKED: imported figures are the client's own
 * record and are read-only from then on, through the UI and through the API
 * alike (see modules/ledger/entryRules.ts). The import is recorded in the
 * audit trail inside the same transaction, so a committed import always has a
 * trail entry naming the file, the user, and the rows it locked — and the rows
 * themselves stay identifiable by their `import_id`.
 *
 * Afterwards, the ledger's own month-end interest for months after the
 * history is recalculated, since the balance it accrued on now starts from
 * the imported history. The imported entries themselves are never
 * recalculated. The loan then closes if the history paid it off.
 */
export async function postImport(
  loanId: string,
  sheet: ImportSheetInput,
  actor: AuditActor & { userId: string },
): Promise<{ importId: string; lockedEntryCount: number; preview: ImportPreview; loanStatus: string | null }> {
  const preview = await previewImport(loanId, sheet);
  if (!preview.canPost) {
    throw new BadRequestError("This sheet cannot be posted until every problem is fixed.", {
      problems: preview.problems,
      conflicts: preview.conflicts,
      duplicates: preview.duplicates,
    });
  }

  const { importId, lockedEntryCount } = await insertImport({
    loanId,
    sheet,
    analysis: preview,
    importedBy: actor.userId,
    onPosted: async (posted, tx) => {
      await recordAudit(
        {
          actor,
          action: "CREATE",
          entityType: AUDIT_ENTITY.LEDGER_IMPORT,
          entityId: posted.importId,
          newValues: {
            loanId,
            fileName: sheet.fileName ?? null,
            sheetName: sheet.sheetName ?? null,
            rowCount: preview.rows.length,
            firstEntryDate: preview.firstEntryDate,
            lastEntryDate: preview.lastEntryDate,
            lastInterestMonth: preview.lastInterestMonth,
            closingBalance: preview.closingBalance,
            // The rows themselves are the ledger entries carrying this import_id.
            lockedEntryCount: posted.lockedEntryCount,
            locked: true,
          },
        },
        tx,
      );
    },
  });

  await recomputeMonthsFrom(loanId, localDate(preview.firstEntryDate!));
  const loanStatus = await syncLoanStatusWithLedger(loanId);

  return { importId, lockedEntryCount, preview, loanStatus };
}

/**
 * Removes an import and everything it posted — the only thing that takes
 * locked rows out of a ledger — then recalculates the ledger's own month-end
 * interest from where the history began and re-checks whether the loan is
 * still closed.
 */
export async function removeImport(
  loanId: string,
  importId: string,
  actor: AuditActor,
): Promise<{ loanStatus: string | null }> {
  await assertLoanExists(loanId);
  const removed = await deleteImport(loanId, importId, async (imp, tx) => {
    await recordAudit(
      {
        actor,
        action: "DELETE",
        entityType: AUDIT_ENTITY.LEDGER_IMPORT,
        entityId: importId,
        oldValues: {
          loanId,
          fileName: imp.fileName,
          sheetName: imp.sheetName,
          rowCount: imp.rowCount,
          firstEntryDate: imp.firstEntryDate,
          lastEntryDate: imp.lastEntryDate,
          closingBalance: imp.closingBalance,
        },
      },
      tx,
    );
  });
  await recomputeMonthsFrom(loanId, localDate(removed.firstEntryDate));
  const loanStatus = await syncLoanStatusWithLedger(loanId);
  return { loanStatus };
}

/* ────────────────────────────────────────────────────────
   APPROVAL GATE

   Posting or removing an import moves a whole block of ledger
   history — there's no split: an employee's request is held
   whole as a PENDING change request; an admin's applies
   immediately as before. `postImport`/`removeImport` already
   write their own audit entry (above), so their appliers are
   registered with `selfAudits: true` to avoid logging twice.
──────────────────────────────────────────────────────── */

export interface RequestPostImportResult {
  result: Awaited<ReturnType<typeof postImport>> | null;
  pendingChangeRequest: Awaited<ReturnType<typeof submitChangeRequest>> | null;
}

export async function requestPostImport(
  loanId: string,
  sheet: ImportSheetInput,
  actor: RequestActor,
): Promise<RequestPostImportResult> {
  if (actor.isAdmin) {
    const result = await postImport(loanId, sheet, actor);
    return { result, pendingChangeRequest: null };
  }

  const pendingChangeRequest = await submitChangeRequest({
    entityType: CHANGE_REQUEST_ENTITY.LEDGER_IMPORT,
    entityId: null,
    action: "CREATE",
    payload: { loanId, sheet, requestedBy: actor.userId },
    loanId,
    requestedBy: actor.userId,
  });

  return { result: null, pendingChangeRequest };
}

export interface RequestRemoveImportResult {
  removed: boolean;
  pendingChangeRequest: Awaited<ReturnType<typeof submitChangeRequest>> | null;
}

export async function requestRemoveImport(
  loanId: string,
  importId: string,
  actor: RequestActor,
): Promise<RequestRemoveImportResult> {
  if (actor.isAdmin) {
    await removeImport(loanId, importId, actor);
    return { removed: true, pendingChangeRequest: null };
  }

  const pendingChangeRequest = await submitChangeRequest({
    entityType: CHANGE_REQUEST_ENTITY.LEDGER_IMPORT,
    entityId: importId,
    action: "DELETE",
    payload: { loanId, requestedBy: actor.userId },
    loanId,
    requestedBy: actor.userId,
  });

  return { removed: false, pendingChangeRequest };
}

// Approving a pending LEDGER_IMPORT change calls the exact same functions
// an admin's own direct action would — registered once, at module load, so
// the generic change-request module never has to import this one.
registerApplier(
  CHANGE_REQUEST_ENTITY.LEDGER_IMPORT,
  "CREATE",
  async (payload) => {
    const { loanId, sheet, requestedBy } = payload as { loanId: string; sheet: ImportSheetInput; requestedBy: string };
    const result = await postImport(loanId, sheet, { userId: requestedBy });
    return { id: result.importId, ...result };
  },
  { selfAudits: true },
);
registerApplier(
  CHANGE_REQUEST_ENTITY.LEDGER_IMPORT,
  "DELETE",
  async (payload, entityId) => {
    const { loanId, requestedBy } = payload as { loanId: string; requestedBy: string };
    return removeImport(loanId, entityId!, { userId: requestedBy });
  },
  { selfAudits: true },
);

export async function getImports(loanId: string): Promise<LedgerImportSummary[]> {
  await assertLoanExists(loanId);
  return listImports(loanId);
}

export async function getLedgerPage(loanId: string, page: number, limit: number): Promise<PaginatedKpiLedgerRows> {
  await assertLoanExists(loanId);
  const { rows, total } = await listPaginated(loanId, page, limit);
  return { rows, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
