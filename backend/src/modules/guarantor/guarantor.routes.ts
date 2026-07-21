import { Router } from "express";

import { asyncHandler } from "../../common/http/asyncHandler";
import { validate } from "../../common/middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import * as guarantorController from "./guarantor.controller";
import {
    createGuarantorSchema,
    guarantorIdParamSchema,
    loanIdParamSchema,
    updateGuarantorSchema,
} from "./guarantor.validators";

/**
 * Mounted at `/loans/:loanId/guarantors` — `mergeParams` so `:loanId` from the
 * parent mount is visible on `req.params` alongside this router's own `:id`.
 */
const router = Router({ mergeParams: true });

router.post(
    "/",
    authenticate,
    validate({ params: loanIdParamSchema, body: createGuarantorSchema }),
    asyncHandler(guarantorController.createGuarantor),
);

router.get(
    "/",
    authenticate,
    validate({ params: loanIdParamSchema }),
    asyncHandler(guarantorController.listGuarantors),
);

router.get(
    "/:id",
    authenticate,
    validate({ params: guarantorIdParamSchema }),
    asyncHandler(guarantorController.getGuarantorById),
);

router.put(
    "/:id",
    authenticate,
    validate({ params: guarantorIdParamSchema, body: updateGuarantorSchema }),
    asyncHandler(guarantorController.updateGuarantor),
);

router.delete(
    "/:id",
    authenticate,
    validate({ params: guarantorIdParamSchema }),
    asyncHandler(guarantorController.deleteGuarantor),
);

export default router;
