import type { Request, Response } from "express";

import { sendCreated, sendSuccess } from "../../common/http/apiResponse";
import { getValidated } from "../../common/middleware/validate";
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
 */

export const createBorrower = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const input = getValidated<typeof createBorrowerSchema>(res, "body");
    const borrower = await borrowerService.createBorrower(input);
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
    _req: Request,
    res: Response,
): Promise<void> => {
    const { id } = getValidated<typeof borrowerIdParamSchema>(res, "params");
    const input = getValidated<typeof updateBorrowerSchema>(res, "body");
    const borrower = await borrowerService.updateBorrower(id, input);
    sendSuccess(res, borrower);
};

export const deleteBorrower = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    const { id } = getValidated<typeof borrowerIdParamSchema>(res, "params");
    await borrowerService.deleteBorrower(id);
    sendSuccess(res, { id, deleted: true });
};
