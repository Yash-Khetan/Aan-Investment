import type { RequestHandler } from "express";
import { listAuditLogs } from "./audit.service";
import type { ListAuditLogsFilters } from "./audit.repository";

export const getAuditLogs: RequestHandler = async (req, res, next) => {
    try {
        const query = req.valid!.query as ListAuditLogsFilters;
        const logs = await listAuditLogs(query);
        res.json({ success: true, data: logs });
    } catch (err) {
        next(err);
    }
};
