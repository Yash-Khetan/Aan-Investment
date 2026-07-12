import { Router } from "express";

import { asyncHandler } from "../../common/http/asyncHandler";
import { validate } from "../../common/middleware/validate";
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
    validate({ body: createBorrowerSchema }),
    asyncHandler(borrowerController.createBorrower),
);

router.get(
    "/",
    validate({ query: listBorrowersQuerySchema }),
    asyncHandler(borrowerController.listBorrowers),
);

router.get(
    "/:id",
    validate({ params: borrowerIdParamSchema }),
    asyncHandler(borrowerController.getBorrowerById),
);

router.put(
    "/:id",
    validate({ params: borrowerIdParamSchema, body: updateBorrowerSchema }),
    asyncHandler(borrowerController.updateBorrower),
);

router.delete(
    "/:id",
    validate({ params: borrowerIdParamSchema }),
    asyncHandler(borrowerController.deleteBorrower),
);

export default router;
