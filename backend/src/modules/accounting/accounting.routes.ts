import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import { recordWriteOffSchema, loanIdParamSchema } from "./accounting.validators";
import * as controller from "./accounting.controller";

/**
 * accountingRouter — mounted at /accounting-entries.
 *  POST /write-off        record a write-off journal entry
 *  GET  /:loanId           fetch the full journal ledger for a loan
 *
 * Disbursements are recorded via /loans/:loanId/disbursements (see the
 * `disbursement` module) — that flow posts the DISBURSEMENT journal entry
 * automatically, so there is no standalone "record disbursement" route here.
 */
export const accountingRouter = Router();

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