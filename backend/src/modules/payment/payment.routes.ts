import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import { recordPaymentSchema } from "./payment.validators";
import * as controller from "./payment.controller";

/**
 * paymentRouter — mounted at /payments.
 *  POST /   record a payment, applying it via the loan's configured waterfall
 */
export const paymentRouter = Router();

paymentRouter.post(
  "/",
  authenticate,
  validate({ body: recordPaymentSchema }),
  controller.createPayment
);