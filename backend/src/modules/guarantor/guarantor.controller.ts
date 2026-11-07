import type { Request, Response } from "express";

import { sendCreated, sendSuccess } from "../../common/http/apiResponse";
import { getValidated } from "../../common/middleware/validate";
import { actorFrom } from "../../common/http/actor";
import { diffFields } from "../../common/diffFields";
import { AUDIT_ENTITY } from "../audit/audit.constants";
import { recordAudit } from "../audit/audit.service";
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
    req: Request,
    res: Response,
): Promise<void> => {
    const { loanId } = getValidated<typeof loanIdParamSchema>(res, "params");
    const input = getValidated<typeof createGuarantorSchema>(res, "body");
    const guarantor = await guarantorService.createGuarantor(loanId, input);

    await recordAudit({
        actor: actorFrom(req),
        action: "CREATE",
        entityType: AUDIT_ENTITY.GUARANTOR,
        entityId: guarantor.id,
        newValues: { loanId, ...input },
    });

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
    req: Request,
    res: Response,
): Promise<void> => {
    const { loanId, id } = getValidated<typeof guarantorIdParamSchema>(
        res,
        "params",
    );
    const input = getValidated<typeof updateGuarantorSchema>(res, "body");
    const existing = await guarantorService.getGuarantorById(loanId, id);
    const guarantor = await guarantorService.updateGuarantor(loanId, id, input);

    const { oldValues, newValues } = diffFields(existing, input);
    await recordAudit({
        actor: actorFrom(req),
        action: "UPDATE",
        entityType: AUDIT_ENTITY.GUARANTOR,
        entityId: id,
        oldValues,
        newValues,
    });

    sendSuccess(res, guarantor);
};

export const deleteGuarantor = async (
    req: Request,
    res: Response,
): Promise<void> => {
    const { loanId, id } = getValidated<typeof guarantorIdParamSchema>(
        res,
        "params",
    );
    const existing = await guarantorService.getGuarantorById(loanId, id);
    await guarantorService.deleteGuarantor(loanId, id);

    await recordAudit({
        actor: actorFrom(req),
        action: "DELETE",
        entityType: AUDIT_ENTITY.GUARANTOR,
        entityId: id,
        oldValues: existing,
    });

    sendSuccess(res, { id, deleted: true });
};
