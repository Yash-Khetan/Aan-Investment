import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import { loanIdParamSchema, createEntrySchema, entryIdParamSchema, updateEntrySchema } from "./ledger.validators";
import * as controller from "./ledger.controller";

/**
 * ledgerRouter — mounted at /ledger. Every route is scoped to one LOAN account.
 *  GET    /:loanId                     full ledger + computed running balances (self-heals missing month-end journals)
 *  POST   /:loanId/entries             record a manual Payment or Receipt
 *  PATCH  /:loanId/entries/:entryId    edit a hand-recorded Payment or Receipt
 *  DELETE /:loanId/entries/:entryId    remove a hand-recorded Payment or Receipt
 *  GET    /:loanId/settings            the interest configuration this ledger is accruing at — read-only
 *  GET    /:loanId/dpd                 month-by-month DPD history for this loan — read-only
 *
 * The two editing routes change a loan's money, so they carry the same
 * `loan:update` grant the Loan module's own edit route does. They reach only a
 * MANUAL Payment/Receipt: an IMPORTED entry is locked and a SYSTEM month-end
 * journal is the ledger's own, and both are refused in the service, not merely
 * hidden in the UI. See modules/ledger/entryRules.ts.
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

ledgerRouter.patch(
  "/:loanId/entries/:entryId",
  authenticate,
  authorize("loan:update"),
  validate({ params: entryIdParamSchema, body: updateEntrySchema }),
  controller.updateEntry
);

ledgerRouter.delete(
  "/:loanId/entries/:entryId",
  authenticate,
  authorize("loan:update"),
  validate({ params: entryIdParamSchema }),
  controller.deleteEntry
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
