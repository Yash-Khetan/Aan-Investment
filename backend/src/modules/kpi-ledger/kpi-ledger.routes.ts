import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import { importIdParamSchema, importSheetSchema, listQuerySchema, loanIdParamSchema } from "./kpi-ledger.validators";
import * as controller from "./kpi-ledger.controller";

/**
 * kpiLedgerRouter — mounted at /kpi-ledger. A loan's imported history.
 *  POST   /:loanId/imports/preview    read a sheet: every row, its balance check, any clash with the ledger
 *  POST   /:loanId/imports            post the sheet into the loan's ledger (refused unless the preview is clean)
 *  GET    /:loanId/imports            the imports posted to this loan
 *  DELETE /:loanId/imports/:importId  remove an import and every entry it posted
 *  GET    /:loanId?page=&limit=       the imported rows exactly as the sheets showed them (read-only)
 */
export const kpiLedgerRouter = Router();

kpiLedgerRouter.use(authenticate);

kpiLedgerRouter.post(
  "/:loanId/imports/preview",
  validate({ params: loanIdParamSchema, body: importSheetSchema }),
  controller.preview,
);
kpiLedgerRouter.post("/:loanId/imports", validate({ params: loanIdParamSchema, body: importSheetSchema }), controller.create);
kpiLedgerRouter.get("/:loanId/imports", validate({ params: loanIdParamSchema }), controller.list);
kpiLedgerRouter.delete("/:loanId/imports/:importId", validate({ params: importIdParamSchema }), controller.remove);
kpiLedgerRouter.get(
  "/:loanId",
  validate({ params: loanIdParamSchema, query: listQuerySchema }),
  controller.getPaginatedLedger,
);
