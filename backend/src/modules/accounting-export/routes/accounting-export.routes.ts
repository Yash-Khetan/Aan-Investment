import { Router } from "express";

import { exportEntries, listEntries } from "../controllers/accounting-export.controller.js";
import { errorHandlerMiddleware } from "../middleware/error-handler.middleware.js";
import { requestLoggerMiddleware } from "../middleware/request-logger.middleware.js";
import { authenticate } from "../../auth/auth.middleware";

/* ============================================================
   ACCOUNTING EXPORT ROUTES
   Mounted at /accounting by the app entry point.

   GET /accounting/:category                → JSON list
   GET /accounting/export/:category?format=  → file download / JSON
   category ∈ principal | interest | penalties | disbursements |
              closures | write-offs | refunds
============================================================ */

export const accountingExportRouter = Router();

accountingExportRouter.use(requestLoggerMiddleware);
accountingExportRouter.use(authenticate);

accountingExportRouter.get("/export/:category", exportEntries);
accountingExportRouter.get("/:category", listEntries);

accountingExportRouter.use(errorHandlerMiddleware);
