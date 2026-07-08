import { Router } from "express";
import { validateUuidParam } from "../middleware/params.middleware";
import {
    createCollateral,
    updateCollateral,
    deleteCollateral,
    getCollateralById,
    getLoanCollaterals,
    updateValuation,
    updateInsurance,
    getCollateralLtv,
} from "../controllers/collateral.controller";

const collateralRouter = Router();

collateralRouter.post("/", createCollateral);

collateralRouter.get("/loan/:loanId", validateUuidParam("loanId"), getLoanCollaterals);

collateralRouter.get("/:id/ltv", validateUuidParam("id"), getCollateralLtv);
collateralRouter.patch("/:id/valuation", validateUuidParam("id"), updateValuation);
collateralRouter.patch("/:id/insurance", validateUuidParam("id"), updateInsurance);

collateralRouter.get("/:id", validateUuidParam("id"), getCollateralById);
collateralRouter.put("/:id", validateUuidParam("id"), updateCollateral);
collateralRouter.delete("/:id", validateUuidParam("id"), deleteCollateral);

export { collateralRouter };
