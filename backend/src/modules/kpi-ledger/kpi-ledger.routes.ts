import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import {
  loanIdParamSchema,
  rowIdParamSchema,
  listQuerySchema,
  attachBodySchema,
  rowPatchSchema,
} from "./kpi-ledger.validators";
import * as controller from "./kpi-ledger.controller";

/**
 * kpiLedgerRouter — mounted at /kpi-ledger. Every route is scoped to one LOAN.
 *  POST   /:loanId/rows            append browser-parsed rows (or one manual entry) to this loan's KPI history
 *  GET    /:loanId?page=&limit=    paginated read of this loan's history (30/page by default)
 *  PATCH  /:loanId/rows/:rowId     edit one row's values
 *  DELETE /:loanId/rows/:rowId     soft-delete one row
 */
export const kpiLedgerRouter = Router();

kpiLedgerRouter.post(
  "/:loanId/rows",
  authenticate,
  validate({ params: loanIdParamSchema, body: attachBodySchema }),
  controller.attachRows
);

kpiLedgerRouter.get(
  "/:loanId",
  authenticate,
  validate({ params: loanIdParamSchema, query: listQuerySchema }),
  controller.getPaginatedLedger
);

kpiLedgerRouter.patch(
  "/:loanId/rows/:rowId",
  authenticate,
  validate({ params: rowIdParamSchema, body: rowPatchSchema }),
  controller.patchRow
);

kpiLedgerRouter.delete(
  "/:loanId/rows/:rowId",
  authenticate,
  validate({ params: rowIdParamSchema }),
  controller.deleteRow
);
