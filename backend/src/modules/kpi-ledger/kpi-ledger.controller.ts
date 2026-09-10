import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../common/errors";
import {
  attachRowsToLoan,
  getLedgerPage,
  editRow,
  removeRow,
} from "./kpi-ledger.service";
import type { KpiLedgerRowInput } from "./kpi-ledger.types";

/** POST /:loanId/rows — append browser-parsed rows (or a single manual entry) to a loan's history. */
export const attachRows: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const { rows, sourceFileName, sourceMeta } = req.valid!.body as {
      rows: KpiLedgerRowInput[];
      sourceFileName?: string;
      sourceMeta?: string;
    };
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const result = await attachRowsToLoan({
      loanId,
      importedBy: req.user.id,
      rows,
      sourceFileName,
      sourceMeta,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/** GET /:loanId?page=&limit= — paginated read of a loan's KPI history. */
export const getPaginatedLedger: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const { page, limit } = req.valid!.query as { page: number; limit: number };
    const result = await getLedgerPage(loanId, page, limit);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/** PATCH /:loanId/rows/:rowId — edit one row's values. */
export const patchRow: RequestHandler = async (req, res, next) => {
  try {
    const { loanId, rowId } = req.valid!.params as { loanId: string; rowId: string };
    const patch = req.valid!.body as KpiLedgerRowInput;
    const row = await editRow(loanId, rowId, patch);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
};

/** DELETE /:loanId/rows/:rowId — soft-delete one row. */
export const deleteRow: RequestHandler = async (req, res, next) => {
  try {
    const { loanId, rowId } = req.valid!.params as { loanId: string; rowId: string };
    await removeRow(loanId, rowId);
    res.json({ success: true, data: { id: rowId, deleted: true } });
  } catch (err) {
    next(err);
  }
};
