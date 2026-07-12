import type { RequestHandler } from "express";

import { UnauthorizedError } from "../../common/errors";
import * as auditService from "./audit.service";
import type { ListAuditQuery } from "./audit.types";
import type { AuditIdParam, ListAuditQueryInput } from "./audit.validators";

/**
 * Audit HTTP controllers — READ ONLY.
 *
 * There is no create/update/delete controller. Audit rows are produced by the
 * business services that call `auditService.record(...)`; the HTTP surface only
 * ever reads them back.
 *
 * Both handlers take the actor from `req.user.id` — the id inside the verified
 * access token — and hand it to the service, which pins every query to it.
 */

/** GET /audit — the authenticated employee's own audit trail. */
export const listMyAuditLogs: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const query = req.valid.query as ListAuditQueryInput;
    const { data, meta } = await auditService.listMyLogs(
        req.user.id,
        query as ListAuditQuery,
    );

    res.status(200).json({ success: true, data, meta });
};

/** GET /audit/:id — one of the authenticated employee's own audit records. */
export const getMyAuditLogById: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const { id } = req.valid.params as AuditIdParam;
    const record = await auditService.getMyLogById(id, req.user.id);

    res.status(200).json({ success: true, data: record });
};
