import { Router } from "express";

import { borrowerRoutes } from "../modules/borrower";
import { loanRoutes } from "../modules/loan";
import { guarantorRoutes } from "../modules/guarantor";
import { disbursementRoutes } from "../modules/disbursement";

/**
 * API v1 router. Each business module mounts its own sub-router here.
 */
const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" } });
});

apiRouter.use("/borrowers", borrowerRoutes);
// Guarantors and disbursements are managed only through the loan they belong
// to — mounted before the general "/loans" router so their nested paths are
// matched first.
apiRouter.use("/loans/:loanId/guarantors", guarantorRoutes);
apiRouter.use("/loans/:loanId/disbursements", disbursementRoutes);
apiRouter.use("/loans", loanRoutes);

export default apiRouter;
