import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import {
  createInterestConfigSchema,
  loanIdParamSchema,
  calculateInterestSchema,
  createInterestRuleSchema,
  ruleIdParamSchema,
  createPenalRuleSchema,
  configIdParamSchema,
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

interestRouter.post(
  "/rules",
  authenticate,
  validate({ body: createInterestRuleSchema }),
  controller.createRule
);

interestRouter.delete(
  "/rules/:ruleId",
  authenticate,
  validate({ params: ruleIdParamSchema }),
  controller.removeRule
);

interestRouter.post(
  "/penal-rules",
  authenticate,
  validate({ body: createPenalRuleSchema }),
  controller.createPenalty
);

interestRouter.get(
  "/rules/:configId",
  authenticate,
  validate({ params: configIdParamSchema }),
  controller.listRules
);

interestRouter.get(
  "/penal-rules/:loanId",
  authenticate,
  validate({ params: loanIdParamSchema }),
  controller.listPenalRules
);