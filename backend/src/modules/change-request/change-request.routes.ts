import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import {
    allFiltersBodySchema,
    bulkIdsBodySchema,
    changeRequestIdParamSchema,
    listChangeRequestsQuerySchema,
    reviewBodySchema,
} from "./change-request.validators";
import * as controller from "./change-request.controller";

/**
 * changeRequestRouter — mounted at /change-requests.
 *  GET  /                      admin — pending change requests (+filters)
 *  GET  /mine                  any authenticated user — their own requests
 *  GET  /pending-loan-ids       any authenticated user — loan ids with something pending (badge)
 *  POST /:id/approve           admin
 *  POST /:id/reject            admin
 *  POST /bulk-approve          admin — body { ids, notes? }
 *  POST /bulk-reject           admin — body { ids, notes? }
 *  POST /approve-all           admin — body { entityType?, loanId?, notes? }
 *  POST /reject-all            admin — body { entityType?, loanId?, notes? }
 */
export const changeRequestRouter = Router();

changeRequestRouter.get(
    "/",
    authenticate,
    authorize("change-request:review"),
    validate({ query: listChangeRequestsQuerySchema }),
    controller.listPending,
);

changeRequestRouter.get(
    "/mine",
    authenticate,
    validate({ query: listChangeRequestsQuerySchema }),
    controller.listMine,
);

changeRequestRouter.get(
    "/pending-loan-ids",
    authenticate,
    controller.listPendingLoanIds,
);

changeRequestRouter.post(
    "/bulk-approve",
    authenticate,
    authorize("change-request:review"),
    validate({ body: bulkIdsBodySchema }),
    controller.bulkApprove,
);

changeRequestRouter.post(
    "/bulk-reject",
    authenticate,
    authorize("change-request:review"),
    validate({ body: bulkIdsBodySchema }),
    controller.bulkReject,
);

changeRequestRouter.post(
    "/approve-all",
    authenticate,
    authorize("change-request:review"),
    validate({ body: allFiltersBodySchema }),
    controller.approveAll,
);

changeRequestRouter.post(
    "/reject-all",
    authenticate,
    authorize("change-request:review"),
    validate({ body: allFiltersBodySchema }),
    controller.rejectAll,
);

changeRequestRouter.post(
    "/:id/approve",
    authenticate,
    authorize("change-request:review"),
    validate({ params: changeRequestIdParamSchema, body: reviewBodySchema }),
    controller.approve,
);

changeRequestRouter.post(
    "/:id/reject",
    authenticate,
    authorize("change-request:review"),
    validate({ params: changeRequestIdParamSchema, body: reviewBodySchema }),
    controller.reject,
);
