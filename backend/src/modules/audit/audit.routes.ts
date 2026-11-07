import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import { listAuditLogsQuerySchema } from "./audit.validators";
import * as controller from "./audit.controller";

/**
 * auditRouter — mounted at /audit-logs. Admin-only: this is the trail of
 * every change any employee has made, so only an admin may read it.
 *  GET /   paginated, filterable by entityType / userId / date range
 */
export const auditRouter = Router();

auditRouter.get(
    "/",
    authenticate,
    authorize("audit:read"),
    validate({ query: listAuditLogsQuerySchema }),
    controller.getAuditLogs,
);
