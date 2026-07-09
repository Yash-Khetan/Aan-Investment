import type { Request, Response } from "express";

import { ReportsService } from "../services/reports.service";
import { asyncHandler } from "../utils/async-handler.util";
import type { ReportName } from "../types/report.types";
import type { ExportQueryInput } from "../validators/report-filters.validator";

function getExportQuery(req: Request): ExportQueryInput {
    return req.reportQuery as ExportQueryInput;
}

function buildFileName(reportName: ReportName, extension: string): string {
    const stamp = new Date().toISOString().slice(0, 10);
    return `${reportName}-${stamp}.${extension}`;
}

function createExportHandler(reportName: ReportName) {
    return asyncHandler(async (req: Request, res: Response) => {
        const { format, ...filters } = getExportQuery(req);

        if (format === "xlsx") {
            const buffer = await ReportsService.exportExcel(reportName, filters);

            res.status(200)
                .set({
                    "Content-Type":
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="${buildFileName(reportName, "xlsx")}"`,
                })
                .send(buffer);
            return;
        }

        if (format === "json") {
            const data = await ReportsService.getReport(reportName, filters);

            res.status(200).json({
                success: true,
                report: reportName,
                generatedAt: new Date().toISOString(),
                count: data.length,
                data,
            });
            return;
        }

        const csv = await ReportsService.exportCSV(reportName, filters);

        res.status(200)
            .set({
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${buildFileName(reportName, "csv")}"`,
            })
            .send(csv);
    });
}

export const exportLoanRegister = createExportHandler("loan-register");
export const exportCustomerReport = createExportHandler("customer-report");
export const exportCollateralReport = createExportHandler("collateral-report");
export const exportCollectionsReport = createExportHandler("collections-report");
export const exportDocumentReport = createExportHandler("document-report");
export const exportPortfolioSummary = createExportHandler("portfolio-summary");
