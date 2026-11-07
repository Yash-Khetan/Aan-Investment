import type { Request, Response } from "express";

import { sendCreated, sendSuccess } from "../../common/http/apiResponse";
import { getValidated } from "../../common/middleware/validate";
import { actorFrom } from "../../common/http/actor";
import { diffFields } from "../../common/diffFields";
import { AUDIT_ENTITY } from "../audit/audit.constants";
import { recordAudit } from "../audit/audit.service";
import * as borrowerService from "./borrower.service";
import type {
    borrowerIdParamSchema,
    createBorrowerSchema,
    listBorrowersQuerySchema,
    updateBorrowerSchema,
} from "./borrower.validators";

/**
 * Borrower HTTP controllers. Thin: read validated input, delegate to the
 * service, shape the response. No business rules or DB access here.
 *
 * Borrower data carries no money fields, so every change here applies
 * immediately — there is no approval gate, only an audit log entry so an
 * admin can see what changed.
 */

export const createBorrower = async (
    req: Request,
    res: Response,
): Promise<void> => {
    const input = getValidated<typeof createBorrowerSchema>(res, "body");
    const borrower = await borrowerService.createBorrower(input);

    await recordAudit({
        actor: actorFrom(req),
        action: "CREATE",
        entityType: AUDIT_ENTITY.BORROWER,
        entityId: borrower.id,
        newValues: input,
    });

    sendCreated(res, borrower);
};

export const listBorrowers = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const query = getValidated<typeof listBorrowersQuerySchema>(res, "query");
    const { data, meta } = await borrowerService.listBorrowers(query);
    sendSuccess(res, data, 200, meta);
};

export const getBorrowerById = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { id } = getValidated<typeof borrowerIdParamSchema>(res, "params");
    const borrower = await borrowerService.getBorrowerById(id);
    sendSuccess(res, borrower);
};

export const updateBorrower = async (
    req: Request,
    res: Response,
): Promise<void> => {
    const { id } = getValidated<typeof borrowerIdParamSchema>(res, "params");
    const input = getValidated<typeof updateBorrowerSchema>(res, "body");
    const existing = await borrowerService.getBorrowerById(id);
    const borrower = await borrowerService.updateBorrower(id, input);

    const { oldValues, newValues } = diffFields(existing as unknown as Record<string, unknown>, input);
    await recordAudit({
        actor: actorFrom(req),
        action: "UPDATE",
        entityType: AUDIT_ENTITY.BORROWER,
        entityId: id,
        oldValues,
        newValues,
    });

    sendSuccess(res, borrower);
};

export const deleteBorrower = async (
    req: Request,
    res: Response,
): Promise<void> => {
    const { id } = getValidated<typeof borrowerIdParamSchema>(res, "params");
    const existing = await borrowerService.getBorrowerById(id);
    await borrowerService.deleteBorrower(id);

    await recordAudit({
        actor: actorFrom(req),
        action: "DELETE",
        entityType: AUDIT_ENTITY.BORROWER,
        entityId: id,
        oldValues: existing,
    });

    sendSuccess(res, { id, deleted: true });
};
