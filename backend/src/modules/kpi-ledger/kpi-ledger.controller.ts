import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../common/errors";
import { getImports, getLedgerPage, postImport, previewImport, removeImport } from "./kpi-ledger.service";
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

/** POST /:loanId/imports — post the sheet into the loan's ledger. */
export const create: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    if (!req.user) throw new UnauthorizedError("Not authenticated");
    const result = await postImport(loanId, req.valid!.body as ImportSheetInput, req.user.id);
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
    res.json({ success: true, data: await removeImport(loanId, importId) });
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
