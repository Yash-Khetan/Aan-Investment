import { Router } from "express";

import { validateQuery } from "../middleware/validate-request.middleware";
import { reportsErrorHandler } from "../middleware/error-handler.middleware";
import { authenticate } from "../../auth/auth.middleware";
import { reportFiltersSchema, exportQuerySchema } from "../validators/report-filters.validator";

import * as reportsController from "../controllers/reports.controller";
import * as exportController from "../controllers/export.controller";

export const reportsRouter = Router();

reportsRouter.use(authenticate);

/* ============================================================
   JSON REPORT ENDPOINTS
============================================================ */

reportsRouter.get(
    "/loan-register",
    validateQuery(reportFiltersSchema),
    reportsController.getLoanRegister,
);

reportsRouter.get(
    "/customer-report",
    validateQuery(reportFiltersSchema),
    reportsController.getCustomerReport,
);

reportsRouter.get(
    "/collateral-report",
    validateQuery(reportFiltersSchema),
    reportsController.getCollateralReport,
);

reportsRouter.get(
    "/collections-report",
    validateQuery(reportFiltersSchema),
    reportsController.getCollectionsReport,
);

reportsRouter.get(
    "/document-report",
    validateQuery(reportFiltersSchema),
    reportsController.getDocumentReport,
);

reportsRouter.get(
    "/portfolio-summary",
    validateQuery(reportFiltersSchema),
    reportsController.getPortfolioSummary,
);

/* ============================================================
   EXPORT ENDPOINTS (?format=csv|xlsx|json)
============================================================ */

reportsRouter.get(
    "/export/loan-register",
    validateQuery(exportQuerySchema),
    exportController.exportLoanRegister,
);

reportsRouter.get(
    "/export/customer-report",
    validateQuery(exportQuerySchema),
    exportController.exportCustomerReport,
);

reportsRouter.get(
    "/export/collateral-report",
    validateQuery(exportQuerySchema),
    exportController.exportCollateralReport,
);

reportsRouter.get(
    "/export/collections-report",
    validateQuery(exportQuerySchema),
    exportController.exportCollectionsReport,
);

reportsRouter.get(
    "/export/document-report",
    validateQuery(exportQuerySchema),
    exportController.exportDocumentReport,
);

reportsRouter.get(
    "/export/portfolio-summary",
    validateQuery(exportQuerySchema),
    exportController.exportPortfolioSummary,
);

reportsRouter.use(reportsErrorHandler);
