import type { RequestHandler } from "express";
import { actorFrom } from "../../common/http/actor";
import * as service from "./change-request.service";
import type { ListChangeRequestsFilters } from "./change-request.types";

export const listPending: RequestHandler = async (req, res, next) => {
    try {
        const query = req.valid!.query as ListChangeRequestsFilters;
        const rows = await service.listPendingForAdmin(query);
        res.json({ success: true, data: rows });
    } catch (err) {
        next(err);
    }
};

export const listMine: RequestHandler = async (req, res, next) => {
    try {
        const actor = actorFrom(req);
        const query = req.valid!.query as ListChangeRequestsFilters;
        const rows = await service.listMine(actor.userId, query);
        res.json({ success: true, data: rows });
    } catch (err) {
        next(err);
    }
};

export const listPendingLoanIds: RequestHandler = async (_req, res, next) => {
    try {
        const loanIds = await service.listPendingLoanIds();
        res.json({ success: true, data: loanIds });
    } catch (err) {
        next(err);
    }
};

export const approve: RequestHandler = async (req, res, next) => {
    try {
        const actor = actorFrom(req);
        const { id } = req.valid!.params as { id: string };
        const { notes } = req.valid!.body as { notes?: string };
        const row = await service.approveChangeRequest(id, actor, notes);
        res.json({ success: true, data: row });
    } catch (err) {
        next(err);
    }
};

export const reject: RequestHandler = async (req, res, next) => {
    try {
        const actor = actorFrom(req);
        const { id } = req.valid!.params as { id: string };
        const { notes } = req.valid!.body as { notes?: string };
        const row = await service.rejectChangeRequest(id, actor, notes);
        res.json({ success: true, data: row });
    } catch (err) {
        next(err);
    }
};

export const bulkApprove: RequestHandler = async (req, res, next) => {
    try {
        const actor = actorFrom(req);
        const { ids, notes } = req.valid!.body as { ids: string[]; notes?: string };
        const results = await service.bulkApprove(ids, actor, notes);
        res.json({ success: true, data: results });
    } catch (err) {
        next(err);
    }
};

export const bulkReject: RequestHandler = async (req, res, next) => {
    try {
        const actor = actorFrom(req);
        const { ids, notes } = req.valid!.body as { ids: string[]; notes?: string };
        const results = await service.bulkReject(ids, actor, notes);
        res.json({ success: true, data: results });
    } catch (err) {
        next(err);
    }
};

export const approveAll: RequestHandler = async (req, res, next) => {
    try {
        const actor = actorFrom(req);
        const { entityType, loanId, notes } = req.valid!.body as {
            entityType?: ListChangeRequestsFilters["entityType"];
            loanId?: string;
            notes?: string;
        };
        const results = await service.approveAll({ entityType, loanId }, actor, notes);
        res.json({ success: true, data: results });
    } catch (err) {
        next(err);
    }
};

export const rejectAll: RequestHandler = async (req, res, next) => {
    try {
        const actor = actorFrom(req);
        const { entityType, loanId, notes } = req.valid!.body as {
            entityType?: ListChangeRequestsFilters["entityType"];
            loanId?: string;
            notes?: string;
        };
        const results = await service.rejectAll({ entityType, loanId }, actor, notes);
        res.json({ success: true, data: results });
    } catch (err) {
        next(err);
    }
};
