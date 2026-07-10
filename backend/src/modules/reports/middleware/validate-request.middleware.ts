import type { NextFunction, Request, Response } from "express";
import type { z, ZodTypeAny } from "zod";

import { ApiError } from "../utils/api-error.util";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            /** Populated by `validateQuery` with the parsed/typed query filters. */
            reportQuery?: unknown;
        }
    }
}

/**
 * Parses and validates `req.query` against the given zod schema, storing
 * the typed result on `req.reportQuery`. Rejects invalid/unknown filters
 * with a 400 before the request reaches a controller.
 */
export function validateQuery<TSchema extends ZodTypeAny>(schema: TSchema) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.query);

        if (!result.success) {
            const message = result.error.issues
                .map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`)
                .join("; ");

            next(ApiError.badRequest(`Invalid request filters: ${message}`));
            return;
        }

        req.reportQuery = result.data as z.infer<TSchema>;
        next();
    };
}
