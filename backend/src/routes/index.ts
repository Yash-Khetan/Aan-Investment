import { Router } from "express";

import { loanRoutes } from "../modules/loan";

/**
 * API v1 router. Each business module mounts its own sub-router here. Only the
 * Loan module is wired at this stage.
 */
const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" } });
});

apiRouter.use("/loans", loanRoutes);

export default apiRouter;
