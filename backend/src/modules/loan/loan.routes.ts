import { Router } from "express";

import { asyncHandler } from "../../common/http/asyncHandler";
import { validate } from "../../common/middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import * as loanController from "./loan.controller";
import {
    createLoanSchema,
    listLoansQuerySchema,
    loanIdParamSchema,
    updateLoanSchema,
} from "./loan.validators";

const router = Router();

router.post(
    "/",
    authenticate,
    validate({ body: createLoanSchema }),
    asyncHandler(loanController.createLoan),
);

router.get(
    "/",
    authenticate,
    validate({ query: listLoansQuerySchema }),
    asyncHandler(loanController.listLoans),
);

router.get(
    "/:id",
    authenticate,
    validate({ params: loanIdParamSchema }),
    asyncHandler(loanController.getLoanById),
);

router.put(
    "/:id",
    authenticate,
    validate({ params: loanIdParamSchema, body: updateLoanSchema }),
    asyncHandler(loanController.updateLoan),
);

router.delete(
    "/:id",
    authenticate,
    validate({ params: loanIdParamSchema }),
    asyncHandler(loanController.deleteLoan),
);

export default router;
