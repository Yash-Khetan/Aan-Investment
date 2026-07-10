import { Router } from "express";

import {
    getDashboardCollections,
    getDashboardPortfolio,
    getDashboardSummary,
} from "../dashboard.controller.js";

const router = Router();

router.get("/summary", getDashboardSummary);
router.get("/portfolio", getDashboardPortfolio);
router.get("/collections", getDashboardCollections);

export default router;
