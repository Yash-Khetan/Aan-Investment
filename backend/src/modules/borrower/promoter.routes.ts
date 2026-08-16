import { Router } from "express";

import { asyncHandler } from "../../common/http/asyncHandler";
import { validate } from "../../common/middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import * as promoterController from "./promoter.controller";
import {
    promoterBorrowerIdParamSchema,
    promoterIdParamSchema,
    promoterSchema,
    updatePromoterSchema,
} from "./borrower.validators";

/**
 * Related persons ("promoters") of a borrower — the CIBIL commercial sheet's
 * "Related Person" block.
 *
 * Mounted at `/api/v1/borrowers/:borrowerId/promoters` — `mergeParams` so
 * `:borrowerId` from the parent mount is visible on `req.params` alongside this
 * router's own `:id`.
 *
 * Mutations require `borrower:update`: adding, changing or removing a related
 * person edits an existing borrower's master data, which is the same permission
 * the borrower PUT is gated on. Reads only require authentication.
 */
const router = Router({ mergeParams: true });

router.post(
    "/",
    authenticate,
    authorize("borrower:update"),
    validate({ params: promoterBorrowerIdParamSchema, body: promoterSchema }),
    asyncHandler(promoterController.createPromoter),
);

router.get(
    "/",
    authenticate,
    validate({ params: promoterBorrowerIdParamSchema }),
    asyncHandler(promoterController.listPromoters),
);

router.get(
    "/:id",
    authenticate,
    validate({ params: promoterIdParamSchema }),
    asyncHandler(promoterController.getPromoterById),
);

router.put(
    "/:id",
    authenticate,
    authorize("borrower:update"),
    validate({ params: promoterIdParamSchema, body: updatePromoterSchema }),
    asyncHandler(promoterController.updatePromoter),
);

router.delete(
    "/:id",
    authenticate,
    authorize("borrower:update"),
    validate({ params: promoterIdParamSchema }),
    asyncHandler(promoterController.deletePromoter),
);

export default router;
