import { Router } from "express";

import { authenticate } from "../../auth/auth.middleware";
import {
    getDashboardCollections,
    getDashboardPortfolio,
    getDashboardSummary,
} from "../dashboard.controller.js";

const router = Router();

router.use(authenticate);

router.get("/summary", getDashboardSummary);
router.get("/portfolio", getDashboardPortfolio);
router.get("/collections", getDashboardCollections);

export default router;
