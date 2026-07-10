import { ApiError } from "../utils/api-error.util";
import { reportsLogger } from "../utils/logger.util";
import { buildCsv, buildExcel } from "../utils/export.util";

import { getLoanRegister } from "./loan-register.service";
import { getCustomerReport } from "./customer-report.service";
import { getCollateralReport } from "./collateral-report.service";
import { getCollectionsReport } from "./collections-report.service";
import { getDocumentReport } from "./document-report.service";
import { getPortfolioSummary } from "./portfolio-summary.service";

import {
    LOAN_REGISTER_COLUMNS,
    CUSTOMER_REPORT_COLUMNS,
    COLLATERAL_REPORT_COLUMNS,
    COLLECTIONS_REPORT_COLUMNS,
    DOCUMENT_REPORT_COLUMNS,
    PORTFOLIO_SUMMARY_COLUMNS,
    REPORT_TITLES,
} from "../constants/report.constants";

import type {
    ReportColumn,
    ReportFilters,
    ReportName,
    ReportRow,
} from "../types/report.types";

type GenericRow = Record<string, unknown>;

interface ReportDefinition {
    fetch: (filters: ReportFilters) => Promise<GenericRow[]>;
    columns: ReportColumn<GenericRow>[];
}

function defineReport<T extends object>(
    fetch: (filters: ReportFilters) => Promise<T[]>,
    columns: ReportColumn<T>[],
): ReportDefinition {
    return {
        fetch: fetch as unknown as (filters: ReportFilters) => Promise<GenericRow[]>,
        columns: columns as unknown as ReportColumn<GenericRow>[],
    };
}

const REPORT_DEFINITIONS: Record<ReportName, ReportDefinition> = {
    "loan-register": defineReport(getLoanRegister, LOAN_REGISTER_COLUMNS),
    "customer-report": defineReport(getCustomerReport, CUSTOMER_REPORT_COLUMNS),
    "collateral-report": defineReport(getCollateralReport, COLLATERAL_REPORT_COLUMNS),
    "collections-report": defineReport(getCollectionsReport, COLLECTIONS_REPORT_COLUMNS),
    "document-report": defineReport(getDocumentReport, DOCUMENT_REPORT_COLUMNS),
    "portfolio-summary": defineReport(
        async (filters) => [await getPortfolioSummary(filters)],
        PORTFOLIO_SUMMARY_COLUMNS,
    ),
};

async function resolveReport(
    reportName: ReportName,
    filters: ReportFilters,
): Promise<{ rows: GenericRow[]; columns: ReportColumn<GenericRow>[] }> {
    const definition = REPORT_DEFINITIONS[reportName];

    if (!definition) {
        throw ApiError.badRequest(`Unknown report: ${reportName}`);
    }

    const startedAt = Date.now();

    let rows: GenericRow[];

    try {
        rows = await definition.fetch(filters);
    } catch (error) {
        reportsLogger.error("Report generation failed", {
            report: reportName,
            message: error instanceof Error ? error.message : "Unknown error",
        });
        throw ApiError.internal(`Failed to generate report: ${REPORT_TITLES[reportName]}`);
    }

    reportsLogger.info("Report generated", {
        report: reportName,
        rowCount: rows.length,
        durationMs: Date.now() - startedAt,
    });

    if (rows.length === 0) {
        reportsLogger.warn("Report generated with no matching data", { report: reportName });
    }

    return { rows, columns: definition.columns };
}

export const ReportsService = {
    getLoanRegister: (filters: ReportFilters) => getLoanRegister(filters),
    getCustomerReport: (filters: ReportFilters) => getCustomerReport(filters),
    getCollateralReport: (filters: ReportFilters) => getCollateralReport(filters),
    getCollectionsReport: (filters: ReportFilters) => getCollectionsReport(filters),
    getDocumentReport: (filters: ReportFilters) => getDocumentReport(filters),
    getPortfolioSummary: (filters: ReportFilters) => getPortfolioSummary(filters),

    async getReport(reportName: ReportName, filters: ReportFilters): Promise<ReportRow[]> {
        const { rows } = await resolveReport(reportName, filters);
        return rows as unknown as ReportRow[];
    },

    async exportCSV(reportName: ReportName, filters: ReportFilters): Promise<string> {
        const startedAt = Date.now();
        const { rows, columns } = await resolveReport(reportName, filters);

        const csv = buildCsv(rows, columns);

        reportsLogger.info("Export generated", {
            report: reportName,
            format: "csv",
            rowCount: rows.length,
            durationMs: Date.now() - startedAt,
        });

        return csv;
    },

    async exportExcel(reportName: ReportName, filters: ReportFilters): Promise<Buffer> {
        const startedAt = Date.now();
        const { rows, columns } = await resolveReport(reportName, filters);

        const buffer = await buildExcel(rows, columns, REPORT_TITLES[reportName]);

        reportsLogger.info("Export generated", {
            report: reportName,
            format: "xlsx",
            rowCount: rows.length,
            durationMs: Date.now() - startedAt,
        });

        return Buffer.from(buffer);
    },
};

export type { ReportName, ReportFilters };
