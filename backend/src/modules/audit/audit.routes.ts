import { Router } from "express";

import { validate } from "../../middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import * as controller from "./audit.controller";
import { auditIdParamSchema, listAuditQuerySchema } from "./audit.validators";

/**
 * auditRouter — mounted at /audit.
 *
 *   GET /       authenticate → the caller's OWN audit records (paginated/filtered)
 *   GET /:id    authenticate → one of the caller's OWN audit records
 *
 * THERE IS DELIBERATELY NO POST, PUT, PATCH OR DELETE.
 *
 * Audit entries are system generated: they are written by business services via
 * `auditService.record(...)` as a side-effect of a real action. A client-writable
 * audit trail is a forgeable audit trail. And per the SRS, audit records are
 * never deleted — the repository has no delete function to expose even if a route
 * wanted one.
 *
 * Visibility: `authenticate` only, no `authorize(...)`. Every employee is allowed
 * to read their OWN trail, and the ownership filter is applied in the repository
 * from `req.user.id`, so there is no permission to check yet. When ADMIN/AUDITOR
 * roles land, they get a separate permission-gated route for the org-wide view;
 * these two routes stay exactly as they are.
 */
export const auditRouter = Router();

auditRouter.get(
    "/",
    authenticate,
    validate({ query: listAuditQuerySchema }),
    controller.listMyAuditLogs,
);

auditRouter.get(
    "/:id",
    authenticate,
    validate({ params: auditIdParamSchema }),
    controller.getMyAuditLogById,
);
