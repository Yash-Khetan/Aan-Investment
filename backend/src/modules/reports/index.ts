import "dotenv/config";
import { pathToFileURL } from "node:url";
import express from "express";

import { reportsRouter } from "./routes/reports.routes";

export { reportsRouter } from "./routes/reports.routes";
export { ReportsService } from "./services/reports.service";

export type {
    ReportName,
    ReportFilters,
    ExportFormat,
    LoanRegisterRow,
    CustomerReportRow,
    CollateralReportRow,
    CollectionsReportRow,
    DocumentReportRow,
    PortfolioSummaryRow,
} from "./types/report.types";

/* ============================================================
   STANDALONE DEV SERVER
   Lets this module be tested in isolation with Postman:

       npx tsx backend/src/modules/reports/index.ts

   This block only runs when the file is executed directly — it is
   a no-op when `reportsRouter`/`ReportsService` are imported into
   the main app (e.g. `import { reportsRouter } from "./modules/reports"`).
============================================================ */

const isDirectExecution =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
    const app = express();
    const PORT = Number(process.env.REPORTS_PORT ?? 4001);

    app.use("/reports", reportsRouter);

    const ENDPOINTS = [
        "GET  /reports/loan-register",
        "GET  /reports/customer-report",
        "GET  /reports/collateral-report",
        "GET  /reports/collections-report",
        "GET  /reports/document-report",
        "GET  /reports/portfolio-summary",
        "GET  /reports/export/loan-register?format=csv|xlsx|json",
        "GET  /reports/export/customer-report?format=csv|xlsx|json",
        "GET  /reports/export/collateral-report?format=csv|xlsx|json",
        "GET  /reports/export/collections-report?format=csv|xlsx|json",
        "GET  /reports/export/document-report?format=csv|xlsx|json",
        "GET  /reports/export/portfolio-summary?format=csv|xlsx|json",
    ];

    app.listen(PORT, () => {
        console.log(`Reports module dev server listening on http://localhost:${PORT}`);
        console.log("Available endpoints:");
        for (const endpoint of ENDPOINTS) {
            console.log(`  http://localhost:${PORT}${endpoint.replace("GET  ", "")}`);
        }
    });
}
