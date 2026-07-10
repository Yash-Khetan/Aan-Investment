import type { Request, Response } from "express";

import { ReportsService } from "../services/reports.service";
import { asyncHandler } from "../utils/async-handler.util";
import type { ReportFiltersInput } from "../validators/report-filters.validator";

function getFilters(req: Request): ReportFiltersInput {
    return req.reportQuery as ReportFiltersInput;
}

function sendReport(res: Response, reportName: string, data: unknown[]): void {
    res.status(200).json({
        success: true,
        report: reportName,
        generatedAt: new Date().toISOString(),
        count: data.length,
        data,
    });
}

export const getLoanRegister = asyncHandler(async (req, res) => {
    const data = await ReportsService.getLoanRegister(getFilters(req));
    sendReport(res, "loan-register", data);
});

export const getCustomerReport = asyncHandler(async (req, res) => {
    const data = await ReportsService.getCustomerReport(getFilters(req));
    sendReport(res, "customer-report", data);
});

export const getCollateralReport = asyncHandler(async (req, res) => {
    const data = await ReportsService.getCollateralReport(getFilters(req));
    sendReport(res, "collateral-report", data);
});

export const getCollectionsReport = asyncHandler(async (req, res) => {
    const data = await ReportsService.getCollectionsReport(getFilters(req));
    sendReport(res, "collections-report", data);
});

export const getDocumentReport = asyncHandler(async (req, res) => {
    const data = await ReportsService.getDocumentReport(getFilters(req));
    sendReport(res, "document-report", data);
});

export const getPortfolioSummary = asyncHandler(async (req, res) => {
    const data = await ReportsService.getPortfolioSummary(getFilters(req));

    res.status(200).json({
        success: true,
        report: "portfolio-summary",
        generatedAt: new Date().toISOString(),
        data,
    });
});
