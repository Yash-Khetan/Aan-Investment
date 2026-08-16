import type { Request, Response } from "express";

import { sendCreated, sendSuccess } from "../../common/http/apiResponse";
import { getValidated } from "../../common/middleware/validate";
import * as promoterService from "./promoter.service";
import type {
    promoterBorrowerIdParamSchema,
    promoterIdParamSchema,
    promoterSchema,
    updatePromoterSchema,
} from "./borrower.validators";

/**
 * Related-person ("promoter") HTTP controllers. Thin: read validated input,
 * delegate to the service, shape the response. No business rules or DB access.
 */

export const createPromoter = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { borrowerId } = getValidated<typeof promoterBorrowerIdParamSchema>(
        res,
        "params",
    );
    const input = getValidated<typeof promoterSchema>(res, "body");
    const promoter = await promoterService.createPromoter(borrowerId, input);
    sendCreated(res, promoter);
};

export const listPromoters = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { borrowerId } = getValidated<typeof promoterBorrowerIdParamSchema>(
        res,
        "params",
    );
    const promoters = await promoterService.listPromotersForBorrower(borrowerId);
    sendSuccess(res, promoters);
};

export const getPromoterById = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { borrowerId, id } = getValidated<typeof promoterIdParamSchema>(
        res,
        "params",
    );
    const promoter = await promoterService.getPromoterById(borrowerId, id);
    sendSuccess(res, promoter);
};

export const updatePromoter = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { borrowerId, id } = getValidated<typeof promoterIdParamSchema>(
        res,
        "params",
    );
    const input = getValidated<typeof updatePromoterSchema>(res, "body");
    const promoter = await promoterService.updatePromoter(borrowerId, id, input);
    sendSuccess(res, promoter);
};

export const deletePromoter = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { borrowerId, id } = getValidated<typeof promoterIdParamSchema>(
        res,
        "params",
    );
    await promoterService.deletePromoter(borrowerId, id);
    sendSuccess(res, { id, deleted: true });
};
