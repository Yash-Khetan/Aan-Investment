import type { Request, Response } from "express";

import { sendCreated, sendSuccess } from "../../common/http/apiResponse";
import { getValidated } from "../../common/middleware/validate";
import * as disbursementService from "./disbursement.service";
import type {
    createDisbursementSchema,
    loanIdParamSchema,
} from "./disbursement.validators";

/**
 * Disbursement HTTP controllers. Thin: read validated input, delegate to the
 * service, shape the response. Every route is nested under a loan
 * (`/loans/:loanId/disbursements`).
 */

export const listDisbursements = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { loanId } = getValidated<typeof loanIdParamSchema>(res, "params");
    const disbursements = await disbursementService.listDisbursementsForLoan(loanId);
    sendSuccess(res, disbursements);
};

export const createDisbursement = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { loanId } = getValidated<typeof loanIdParamSchema>(res, "params");
    const input = getValidated<typeof createDisbursementSchema>(res, "body");
    const disbursement = await disbursementService.recordDisbursement(loanId, input);
    sendCreated(res, disbursement);
};
