import type { Request, Response } from "express";

import { sendCreated, sendSuccess } from "../../common/http/apiResponse";
import { getValidated } from "../../common/middleware/validate";
import * as guarantorService from "./guarantor.service";
import type {
    createGuarantorSchema,
    guarantorIdParamSchema,
    loanIdParamSchema,
    updateGuarantorSchema,
} from "./guarantor.validators";

/**
 * Guarantor HTTP controllers. Thin: read validated input, delegate to the
 * service, shape the response. No business rules or DB access here. Every
 * route is nested under a loan (`/loans/:loanId/guarantors`).
 */

export const createGuarantor = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { loanId } = getValidated<typeof loanIdParamSchema>(res, "params");
    const input = getValidated<typeof createGuarantorSchema>(res, "body");
    const guarantor = await guarantorService.createGuarantor(loanId, input);
    sendCreated(res, guarantor);
};

export const listGuarantors = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { loanId } = getValidated<typeof loanIdParamSchema>(res, "params");
    const guarantors = await guarantorService.listGuarantorsForLoan(loanId);
    sendSuccess(res, guarantors);
};

export const getGuarantorById = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { loanId, id } = getValidated<typeof guarantorIdParamSchema>(
        res,
        "params",
    );
    const guarantor = await guarantorService.getGuarantorById(loanId, id);
    sendSuccess(res, guarantor);
};

export const updateGuarantor = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { loanId, id } = getValidated<typeof guarantorIdParamSchema>(
        res,
        "params",
    );
    const input = getValidated<typeof updateGuarantorSchema>(res, "body");
    const guarantor = await guarantorService.updateGuarantor(loanId, id, input);
    sendSuccess(res, guarantor);
};

export const deleteGuarantor = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { loanId, id } = getValidated<typeof guarantorIdParamSchema>(
        res,
        "params",
    );
    await guarantorService.deleteGuarantor(loanId, id);
    sendSuccess(res, { id, deleted: true });
};
