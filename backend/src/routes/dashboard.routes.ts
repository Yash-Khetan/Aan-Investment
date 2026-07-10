import { Router } from "express";

import {
    getDashboardCollections,
    getDashboardPortfolio,
    getDashboardSummary,
} from "../modules/dashboard/dashboard.controller.js";

const router = Router();

router.get("/summary", getDashboardSummary);
router.get("/portfolio", getDashboardPortfolio);
router.get("/collections", getDashboardCollections);

export default router;
