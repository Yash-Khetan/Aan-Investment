import { Router } from "express";

import { borrowerRoutes } from "../modules/borrower";
import { loanRoutes } from "../modules/loan";

/**
 * API v1 router. Each business module mounts its own sub-router here.
 */
const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" } });
});

apiRouter.use("/borrowers", borrowerRoutes);
apiRouter.use("/loans", loanRoutes);

export default apiRouter;
