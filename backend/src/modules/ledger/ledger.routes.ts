import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import {
  loanIdParamSchema,
  entryIdParamSchema,
  createEntrySchema,
  editRateSchema,
  updateSettingsSchema,
} from "./ledger.validators";
import * as controller from "./ledger.controller";

/**
 * ledgerRouter — mounted at /ledger. Every route is scoped to one LOAN account.
 *  GET   /:loanId                        full ledger + computed running balances (self-heals missing month-end journals)
 *  POST  /:loanId/entries                record a manual Payment or Receipt
 *  PATCH /:loanId/entries/:entryId/rate  edit a Journal Interest/TDS row's rate (recomputes that row only)
 *  GET   /:loanId/settings               the loan's own Interest/TDS rates
 *  PUT   /:loanId/settings               update the loan's Interest/TDS rates (writes to the loan row)
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
  "/:loanId/entries/:entryId/rate",
  authenticate,
  validate({ params: entryIdParamSchema, body: editRateSchema }),
  controller.editRate
);

ledgerRouter.get(
  "/:loanId/settings",
  authenticate,
  validate({ params: loanIdParamSchema }),
  controller.getLedgerSettings
);

ledgerRouter.put(
  "/:loanId/settings",
  authenticate,
  validate({ params: loanIdParamSchema, body: updateSettingsSchema }),
  controller.putLedgerSettings
);
