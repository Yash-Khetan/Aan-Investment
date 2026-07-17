import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import { generateScheduleSchema, loanIdParamSchema } from "./repayment.validators";
import * as controller from "./repayment.controller";

/**
 * repaymentRouter — mounted at /repayment-schedules.
 *  POST /              generate + save a new schedule revision for a loan
 *  GET  /:loanId        fetch the current schedule + installments for a loan
 */
export const repaymentRouter = Router();

repaymentRouter.post(
  "/",
  authenticate,
  validate({ body: generateScheduleSchema }),
  controller.generateSchedule
);

repaymentRouter.get(
  "/:loanId",
  authenticate,
  validate({ params: loanIdParamSchema }),
  controller.getSchedule
);