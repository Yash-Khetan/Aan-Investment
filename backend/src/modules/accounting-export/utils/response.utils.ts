import type { Response } from "express";

import type { AccountingExportResult } from "../types/accounting-export.types.js";

/* ============================================================
   RESPONSE HELPERS
============================================================ */

export function sendEntriesResponse(res: Response, result: AccountingExportResult): void {
    res.status(200).json({
        success: true,
        count: result.count,
        generatedAt: result.generatedAt,
        filters: result.filters,
        notes: result.notes,
        data: result.rows,
    });
}
