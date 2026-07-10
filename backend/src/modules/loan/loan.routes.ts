import { Router } from "express";

import { asyncHandler } from "../../common/http/asyncHandler";
import { validate } from "../../common/middleware/validate";
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
    validate({ body: createLoanSchema }),
    asyncHandler(loanController.createLoan),
);

router.get(
    "/",
    validate({ query: listLoansQuerySchema }),
    asyncHandler(loanController.listLoans),
);

router.get(
    "/:id",
    validate({ params: loanIdParamSchema }),
    asyncHandler(loanController.getLoanById),
);

router.put(
    "/:id",
    validate({ params: loanIdParamSchema, body: updateLoanSchema }),
    asyncHandler(loanController.updateLoan),
);

router.delete(
    "/:id",
    validate({ params: loanIdParamSchema }),
    asyncHandler(loanController.deleteLoan),
);

export default router;
