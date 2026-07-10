import type { Request, Response } from "express";
import { CollateralService } from "../services/collateral.service";
import { mapErrorToHttpResponse } from "../utils/http-error-mapper";
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
        res.status(201).json(collateral);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function updateCollateral(req: Request, res: Response): Promise<void> {
    try {
        const input = req.body as UpdateCollateralInput;
        const collateral = await CollateralService.updateCollateral(String(req.params.id), input);
        res.status(200).json(collateral);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function deleteCollateral(req: Request, res: Response): Promise<void> {
    try {
        await CollateralService.deleteCollateral(String(req.params.id));
        res.status(204).send();
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
        const collateral = await CollateralService.updateValuation(String(req.params.id), input);
        res.status(200).json(collateral);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function updateInsurance(req: Request, res: Response): Promise<void> {
    try {
        const input = req.body as UpdateInsuranceInput;
        const insurance = await CollateralService.updateInsurance(String(req.params.id), input);
        res.status(200).json(insurance);
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
