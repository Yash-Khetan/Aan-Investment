import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import {
  borrowerIdParamSchema,
  entryIdParamSchema,
  createEntrySchema,
  editRateSchema,
  updateSettingsSchema,
} from "./borrowerLedger.validators";
import * as controller from "./borrowerLedger.controller";

/**
 * borrowerLedgerRouter — mounted at /borrower-ledger.
 *  GET   /:borrowerId                      full ledger + computed running balances (self-heals missing month-end journals)
 *  POST  /:borrowerId/entries              record a manual Payment or Receipt
 *  PATCH /:borrowerId/entries/:entryId/rate  edit a Journal Interest/TDS row's rate (recomputes amount)
 *  GET   /:borrowerId/settings             default Interest/TDS rate for the borrower
 *  PUT   /:borrowerId/settings             update default Interest/TDS rate
 */
export const borrowerLedgerRouter = Router();

borrowerLedgerRouter.get(
  "/:borrowerId",
  authenticate,
  validate({ params: borrowerIdParamSchema }),
  controller.getLedger
);

borrowerLedgerRouter.post(
  "/:borrowerId/entries",
  authenticate,
  validate({ params: borrowerIdParamSchema, body: createEntrySchema }),
  controller.createEntry
);

borrowerLedgerRouter.patch(
  "/:borrowerId/entries/:entryId/rate",
  authenticate,
  validate({ params: entryIdParamSchema, body: editRateSchema }),
  controller.editRate
);

borrowerLedgerRouter.get(
  "/:borrowerId/settings",
  authenticate,
  validate({ params: borrowerIdParamSchema }),
  controller.getLedgerSettings
);

borrowerLedgerRouter.put(
  "/:borrowerId/settings",
  authenticate,
  validate({ params: borrowerIdParamSchema, body: updateSettingsSchema }),
  controller.putLedgerSettings
);
