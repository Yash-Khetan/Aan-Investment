import { Router } from "express";

import { asyncHandler } from "../../common/http/asyncHandler";
import { validate } from "../../common/middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import * as borrowerController from "./borrower.controller";
import {
    borrowerIdParamSchema,
    createBorrowerSchema,
    listBorrowersQuerySchema,
    updateBorrowerSchema,
} from "./borrower.validators";

const router = Router();

router.post(
    "/",
    authenticate,
    validate({ body: createBorrowerSchema }),
    asyncHandler(borrowerController.createBorrower),
);

router.get(
    "/",
    authenticate,
    validate({ query: listBorrowersQuerySchema }),
    asyncHandler(borrowerController.listBorrowers),
);

router.get(
    "/:id",
    authenticate,
    validate({ params: borrowerIdParamSchema }),
    asyncHandler(borrowerController.getBorrowerById),
);

router.put(
    "/:id",
    authenticate,
    validate({ params: borrowerIdParamSchema, body: updateBorrowerSchema }),
    asyncHandler(borrowerController.updateBorrower),
);

router.delete(
    "/:id",
    authenticate,
    validate({ params: borrowerIdParamSchema }),
    asyncHandler(borrowerController.deleteBorrower),
);

export default router;
