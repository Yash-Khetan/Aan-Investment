import type { Request, Response } from "express";
import { CollateralService } from "../services/collateral.service";
import { mapErrorToHttpResponse } from "../utils/http-error-mapper";
import { actorFrom } from "../../../common/http/actor";
import { AUDIT_ENTITY } from "../../audit/audit.constants";
import { recordAudit } from "../../audit/audit.service";
import type {
    CreateCollateralInput,
    UpdateCollateralInput,
    UpdateValuationInput,
    UpdateInsuranceInput,
} from "../types/collateral.types";

export async function createCollateral(req: Request, res: Response): Promise<void> {
    try {
        const input = req.body as CreateCollateralInput;
        const collateral = await CollateralService.createCollateral(input);

        await recordAudit({
            actor: actorFrom(req),
            action: "CREATE",
            entityType: AUDIT_ENTITY.COLLATERAL,
            entityId: collateral.id,
            newValues: input,
        });

        res.status(201).json(collateral);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function updateCollateral(req: Request, res: Response): Promise<void> {
    try {
        const input = req.body as UpdateCollateralInput;
        const result = await CollateralService.requestUpdateCollateral(String(req.params.id), input, actorFrom(req));
        res.status(200).json(result);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function deleteCollateral(req: Request, res: Response): Promise<void> {
    try {
        const result = await CollateralService.requestDeleteCollateral(String(req.params.id), actorFrom(req));
        res.status(200).json(result);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function getCollateralById(req: Request, res: Response): Promise<void> {
    try {
        const collateral = await CollateralService.getCollateral(String(req.params.id));
        res.status(200).json(collateral);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function getLoanCollaterals(req: Request, res: Response): Promise<void> {
    try {
        const collaterals = await CollateralService.getLoanCollaterals(String(req.params.loanId));
        res.status(200).json(collaterals);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function updateValuation(req: Request, res: Response): Promise<void> {
    try {
        const input = req.body as UpdateValuationInput;
        const result = await CollateralService.requestUpdateValuation(String(req.params.id), input, actorFrom(req));
        res.status(200).json(result);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function updateInsurance(req: Request, res: Response): Promise<void> {
    try {
        const input = req.body as UpdateInsuranceInput;
        const result = await CollateralService.requestUpdateInsurance(String(req.params.id), input, actorFrom(req));
        res.status(200).json(result);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function getCollateralLtv(req: Request, res: Response): Promise<void> {
    try {
        const result = await CollateralService.calculateLTV(String(req.params.id));
        res.status(200).json(result);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}
