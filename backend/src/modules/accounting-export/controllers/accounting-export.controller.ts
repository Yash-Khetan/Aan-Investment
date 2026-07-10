import type { Request, Response } from "express";

import { EXPORT_CATEGORIES, type ExportCategorySlug } from "../constants/export-categories.constants.js";
import { EXPORT_FORMAT_META } from "../constants/export-formats.constants.js";
import { AccountingExportService } from "../services/accounting-export.service.js";
import type { AccountingExportResult } from "../types/accounting-export.types.js";
import { logger } from "../utils/logger.utils.js";
import { NoDataFoundError, ValidationError } from "../utils/http-error.utils.js";
import { parseAccountingExportFilters, parseExportFormat } from "../validators/accounting-export.validator.js";
import { sendEntriesResponse } from "../utils/response.utils.js";

const service = new AccountingExportService();

type EntriesFetcher = (
    filters: ReturnType<typeof parseAccountingExportFilters>,
) => Promise<AccountingExportResult>;

const ENTRY_FETCHERS: Record<ExportCategorySlug, EntriesFetcher> = {
    principal: (filters) => service.getPrincipalEntries(filters),
    interest: (filters) => service.getInterestEntries(filters),
    penalties: (filters) => service.getPenaltyEntries(filters),
    disbursements: (filters) => service.getLoanDisbursements(filters),
    closures: (filters) => service.getLoanClosures(filters),
    "write-offs": (filters) => service.getWriteOffEntries(filters),
    refunds: (filters) => service.getRefundEntries(filters),
};

function resolveCategory(slug: string): ExportCategorySlug {
    if (!(slug in EXPORT_CATEGORIES)) {
        throw new ValidationError(
            `Unknown accounting export category: '${slug}'. Expected one of ${Object.keys(EXPORT_CATEGORIES).join(", ")}.`,
        );
    }

    return slug as ExportCategorySlug;
}

/* ============================================================
   LIST ENDPOINTS — GET /accounting/:category
============================================================ */

export async function listEntries(req: Request, res: Response): Promise<void> {
    const category = resolveCategory(req.params.category as string);
    const filters = parseAccountingExportFilters(req.query as Record<string, unknown>);

    const result = await ENTRY_FETCHERS[category](filters);

    logger.info("Export generated", {
        category,
        format: "json",
        rowCount: result.count,
    });

    sendEntriesResponse(res, result);
}

/* ============================================================
   EXPORT ENDPOINTS — GET /accounting/export/:category
============================================================ */

export async function exportEntries(req: Request, res: Response): Promise<void> {
    const category = resolveCategory(req.params.category as string);
    const filters = parseAccountingExportFilters(req.query as Record<string, unknown>);
    const format = parseExportFormat(req.query as Record<string, unknown>);

    const result = await ENTRY_FETCHERS[category](filters);

    if (format === "json") {
        logger.info("Export generated", { category, format, rowCount: result.count });
        sendEntriesResponse(res, result);
        return;
    }

    if (result.count === 0) {
        throw new NoDataFoundError(
            `No ${EXPORT_CATEGORIES[category].label} entries found for the given filters.`,
        );
    }

    const meta = EXPORT_FORMAT_META[format];
    const fileBase = `${category}-${new Date().toISOString().slice(0, 10)}`;

    res.setHeader("Content-Type", meta.contentType);
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileBase}.${meta.extension}"`,
    );

    if (format === "csv") {
        res.status(200).send(service.exportCSV(result.rows));
    } else {
        const buffer = await service.exportExcel(result.rows, EXPORT_CATEGORIES[category].label);
        res.status(200).send(buffer);
    }

    logger.info("Export generated", { category, format, rowCount: result.count });
}
