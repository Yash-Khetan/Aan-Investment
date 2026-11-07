import type { Request, Response } from "express";

import { sendCreated, sendSuccess } from "../../common/http/apiResponse";
import { getValidated } from "../../common/middleware/validate";
import { actorFrom } from "../../common/http/actor";
import { diffFields } from "../../common/diffFields";
import { AUDIT_ENTITY } from "../audit/audit.constants";
import { recordAudit } from "../audit/audit.service";
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
 *
 * No money fields here either — every change applies immediately, logged
 * for admin visibility only.
 */

export const createPromoter = async (
    req: Request,
    res: Response,
): Promise<void> => {
    const { borrowerId } = getValidated<typeof promoterBorrowerIdParamSchema>(
        res,
        "params",
    );
    const input = getValidated<typeof promoterSchema>(res, "body");
    const promoter = await promoterService.createPromoter(borrowerId, input);

    await recordAudit({
        actor: actorFrom(req),
        action: "CREATE",
        entityType: AUDIT_ENTITY.PROMOTER,
        entityId: promoter.id,
        newValues: { borrowerId, ...input },
    });

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
    req: Request,
    res: Response,
): Promise<void> => {
    const { borrowerId, id } = getValidated<typeof promoterIdParamSchema>(
        res,
        "params",
    );
    const input = getValidated<typeof updatePromoterSchema>(res, "body");
    const existing = await promoterService.getPromoterById(borrowerId, id);
    const promoter = await promoterService.updatePromoter(borrowerId, id, input);

    const { oldValues, newValues } = diffFields(existing, input);
    await recordAudit({
        actor: actorFrom(req),
        action: "UPDATE",
        entityType: AUDIT_ENTITY.PROMOTER,
        entityId: id,
        oldValues,
        newValues,
    });

    sendSuccess(res, promoter);
};

export const deletePromoter = async (
    req: Request,
    res: Response,
): Promise<void> => {
    const { borrowerId, id } = getValidated<typeof promoterIdParamSchema>(
        res,
        "params",
    );
    const existing = await promoterService.getPromoterById(borrowerId, id);
    await promoterService.deletePromoter(borrowerId, id);

    await recordAudit({
        actor: actorFrom(req),
        action: "DELETE",
        entityType: AUDIT_ENTITY.PROMOTER,
        entityId: id,
        oldValues: existing,
    });

    sendSuccess(res, { id, deleted: true });
};
