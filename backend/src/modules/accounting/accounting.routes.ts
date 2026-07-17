import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import { recordDisbursementSchema, recordWriteOffSchema, loanIdParamSchema } from "./accounting.validators";
import * as controller from "./accounting.controller";

/**
 * accountingRouter — mounted at /accounting-entries.
 *  POST /disbursement    record a disbursement journal entry
 *  POST /write-off        record a write-off journal entry
 *  GET  /:loanId           fetch the full journal ledger for a loan
 */
export const accountingRouter = Router();

accountingRouter.post(
  "/disbursement",
  authenticate,
  validate({ body: recordDisbursementSchema }),
  controller.createDisbursementEntry
);

accountingRouter.post(
  "/write-off",
  authenticate,
  validate({ body: recordWriteOffSchema }),
  controller.createWriteOffEntry
);

accountingRouter.get(
  "/:loanId",
  authenticate,
  validate({ params: loanIdParamSchema }),
  controller.getLedger
);