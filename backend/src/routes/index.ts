import { Router } from "express";

import { borrowerRoutes, promoterRoutes } from "../modules/borrower";
import { loanRoutes } from "../modules/loan";
import { guarantorRoutes } from "../modules/guarantor";

/**
 * API v1 router. Each business module mounts its own sub-router here.
 */
const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" } });
});

// Related persons are managed only through the borrower they belong to —
// mounted before the general "/borrowers" router so the nested path matches
// first, mirroring how guarantors hang off a loan.
apiRouter.use("/borrowers/:borrowerId/promoters", promoterRoutes);
apiRouter.use("/borrowers", borrowerRoutes);
// Guarantors are managed only through the loan they belong to — mounted
// before the general "/loans" router so the nested path is matched first.
// Disbursements are not a route of their own: they are Payment entries on the
// loan's ledger (/ledger/:loanId/entries), the only way money enters a loan.
apiRouter.use("/loans/:loanId/guarantors", guarantorRoutes);
apiRouter.use("/loans", loanRoutes);

export default apiRouter;
