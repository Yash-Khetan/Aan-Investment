import { Router } from "express";

import { asyncHandler } from "../../common/http/asyncHandler";
import { validate } from "../../common/middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import * as disbursementController from "./disbursement.controller";
import {
    createDisbursementSchema,
    loanIdParamSchema,
} from "./disbursement.validators";

/**
 * Mounted at `/loans/:loanId/disbursements` — `mergeParams` so `:loanId` from
 * the parent mount is visible on `req.params`.
 */
const router = Router({ mergeParams: true });

router.get(
    "/",
    authenticate,
    validate({ params: loanIdParamSchema }),
    asyncHandler(disbursementController.listDisbursements),
);

router.post(
    "/",
    authenticate,
    validate({ params: loanIdParamSchema, body: createDisbursementSchema }),
    asyncHandler(disbursementController.createDisbursement),
);

export default router;
