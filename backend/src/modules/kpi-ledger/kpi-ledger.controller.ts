import type { RequestHandler } from "express";
import { actorFrom } from "../../common/http/actor";
import {
  getImports,
  getLedgerPage,
  previewImport,
  requestPostImport,
  requestRemoveImport,
} from "./kpi-ledger.service";
import type { ImportSheetInput } from "./kpi-ledger.types";

/** POST /:loanId/imports/preview — what posting this sheet would do. Writes nothing. */
export const preview: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    res.json({ success: true, data: await previewImport(loanId, req.valid!.body as ImportSheetInput) });
  } catch (err) {
    next(err);
  }
};

/** POST /:loanId/imports — post the sheet into the loan's ledger, locking every entry it posts. */
export const create: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const result = await requestPostImport(loanId, req.valid!.body as ImportSheetInput, actorFrom(req));
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/** GET /:loanId/imports — the imports posted to this loan. */
export const list: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    res.json({ success: true, data: await getImports(loanId) });
  } catch (err) {
    next(err);
  }
};

/** DELETE /:loanId/imports/:importId — remove an import and everything it posted. */
export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { loanId, importId } = req.valid!.params as { loanId: string; importId: string };
    const result = await requestRemoveImport(loanId, importId, actorFrom(req));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/** GET /:loanId?page=&limit= — the imported rows exactly as the sheets showed them. */
export const getPaginatedLedger: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const { page, limit } = req.valid!.query as { page: number; limit: number };
    res.json({ success: true, data: await getLedgerPage(loanId, page, limit) });
  } catch (err) {
    next(err);
  }
};
