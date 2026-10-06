import { Router } from "express";

import { authenticate } from "../../auth/auth.middleware";
import { getDashboardPortfolio, getDashboardSummary } from "../dashboard.controller.js";

const router = Router();

router.use(authenticate);

router.get("/summary", getDashboardSummary);
router.get("/portfolio", getDashboardPortfolio);

export default router;
