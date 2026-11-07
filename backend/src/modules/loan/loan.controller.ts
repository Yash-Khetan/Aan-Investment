import type { Request, Response } from "express";

import { sendCreated, sendSuccess } from "../../common/http/apiResponse";
import { getValidated } from "../../common/middleware/validate";
import { actorFrom } from "../../common/http/actor";
import { AUDIT_ENTITY } from "../audit/audit.constants";
import { recordAudit } from "../audit/audit.service";
import * as loanService from "./loan.service";
import type {
    createLoanSchema,
    listLoansQuerySchema,
    loanIdParamSchema,
    updateLoanSchema,
} from "./loan.validators";

/**
 * Loan HTTP controllers. Intentionally thin: read validated input, delegate to
 * the service, shape the response. No business rules or DB access here.
 */

export const createLoan = async (req: Request, res: Response): Promise<void> => {
    const input = getValidated<typeof createLoanSchema>(res, "body");
    const loan = await loanService.createLoan(input);

    await recordAudit({
        actor: actorFrom(req),
        action: "CREATE",
        entityType: AUDIT_ENTITY.LOAN,
        entityId: loan.id,
        newValues: input,
    });

    sendCreated(res, loan);
};

export const listLoans = async (_req: Request, res: Response): Promise<void> => {
    const query = getValidated<typeof listLoansQuerySchema>(res, "query");
    const { data, meta } = await loanService.listLoans(query);
    sendSuccess(res, data, 200, meta);
};

export const getLoanById = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { id } = getValidated<typeof loanIdParamSchema>(res, "params");
    const loan = await loanService.getLoanById(id);
    sendSuccess(res, loan);
};

export const updateLoan = async (req: Request, res: Response): Promise<void> => {
    const { id } = getValidated<typeof loanIdParamSchema>(res, "params");
    const input = getValidated<typeof updateLoanSchema>(res, "body");
    const { loan, pendingChangeRequest } = await loanService.requestUpdateLoan(id, input, actorFrom(req));
    sendSuccess(res, { loan, pendingChangeRequest });
};

export const deleteLoan = async (
    req: Request,
    res: Response,
): Promise<void> => {
    const { id } = getValidated<typeof loanIdParamSchema>(res, "params");
    const { deleted, pendingChangeRequest } = await loanService.requestDeleteLoan(id, actorFrom(req));
    sendSuccess(res, { id, deleted, pendingChangeRequest });
};
