import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import { loanIdParamSchema, createEntrySchema } from "./ledger.validators";
import * as controller from "./ledger.controller";

/**
 * ledgerRouter — mounted at /ledger. Every route is scoped to one LOAN account.
 *  GET   /:loanId            full ledger + computed running balances (self-heals missing month-end journals)
 *  POST  /:loanId/entries    record a manual Payment or Receipt
 *  GET   /:loanId/settings   the interest configuration this ledger is accruing at — read-only
 *  GET   /:loanId/dpd        month-by-month DPD history for this loan — read-only
 *
 * There is deliberately no rate-writing route here. The Loan module is the
 * source of the current interest configuration; the ledger reads it and
 * snapshots what each posted month accrued under. Editing a rate from this
 * side would either fork a second source of truth or rewrite history.
 */
export const ledgerRouter = Router();

ledgerRouter.get(
  "/:loanId",
  authenticate,
  validate({ params: loanIdParamSchema }),
  controller.getLedger
);

ledgerRouter.post(
  "/:loanId/entries",
  authenticate,
  validate({ params: loanIdParamSchema, body: createEntrySchema }),
  controller.createEntry
);

ledgerRouter.get(
  "/:loanId/settings",
  authenticate,
  validate({ params: loanIdParamSchema }),
  controller.getLedgerSettings
);

ledgerRouter.get(
  "/:loanId/dpd",
  authenticate,
  validate({ params: loanIdParamSchema }),
  controller.getDpdHistory
);
