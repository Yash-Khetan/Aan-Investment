import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import {
  createInterestConfigSchema,
  loanIdParamSchema,
  calculateInterestSchema,
} from "./interest.validators";
import * as controller from "./interest.controller";

/**
 * interestRouter — mounted at /interest-rules.
 *  POST /                      create a new interest config revision for a loan
 *  GET  /:loanId                fetch the current interest config for a loan
 *  POST /:loanId/calculate       run the full interest calculation for a loan as of a date
 */
export const interestRouter = Router();

interestRouter.post(
  "/",
  authenticate,
  validate({ body: createInterestConfigSchema }),
  controller.createInterestConfig
);

interestRouter.get(
  "/:loanId",
  authenticate,
  validate({ params: loanIdParamSchema }),
  controller.getInterestConfig
);

interestRouter.post(
  "/:loanId/calculate",
  authenticate,
  validate({ params: loanIdParamSchema, body: calculateInterestSchema }),
  controller.calculateInterest
);