import { Router } from "express";
import { validateUuidParam } from "../middleware/params.middleware";
import {
    createActivity,
    updateActivity,
    deleteActivity,
    getActivityById,
    getLoanActivities,
    getCustomerActivities,
    updateStatus,
    updateFollowUp,
    createPromiseToPay,
    closePromiseToPay,
} from "../controllers/collections.controller";

const collectionsRouter = Router();

collectionsRouter.post("/", createActivity);

collectionsRouter.get("/loan/:loanId", validateUuidParam("loanId"), getLoanActivities);
collectionsRouter.get("/customer/:customerId", validateUuidParam("customerId"), getCustomerActivities);

collectionsRouter.patch("/:id/status", validateUuidParam("id"), updateStatus);
collectionsRouter.patch("/:id/follow-up", validateUuidParam("id"), updateFollowUp);
collectionsRouter.post("/:id/promise-to-pay", validateUuidParam("id"), createPromiseToPay);
collectionsRouter.patch("/:id/promise-to-pay/close", validateUuidParam("id"), closePromiseToPay);

collectionsRouter.get("/:id", validateUuidParam("id"), getActivityById);
collectionsRouter.put("/:id", validateUuidParam("id"), updateActivity);
collectionsRouter.delete("/:id", validateUuidParam("id"), deleteActivity);

export { collectionsRouter };
