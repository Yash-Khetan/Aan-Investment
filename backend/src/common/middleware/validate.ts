import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodTypeAny, infer as ZodInfer } from "zod";

export interface ValidationSchemas {
    body?: ZodTypeAny;
    query?: ZodTypeAny;
    params?: ZodTypeAny;
}

/**
 * Validation middleware. Parses body/query/params against the provided Zod
 * schemas and stores the (typed, coerced) result on `res.locals.validated`.
 *
 * Express 5 exposes `req.query` as a read-only getter, so validated values are
 * intentionally kept in `res.locals` rather than mutating the request. Zod
 * failures are passed to `next` and formatted as 422s by the error handler.
 */
export const validate = (schemas: ValidationSchemas): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const validated: {
                body?: unknown;
                query?: unknown;
                params?: unknown;
            } = {};

            if (schemas.params)
                validated.params = schemas.params.parse(req.params);
            if (schemas.query) validated.query = schemas.query.parse(req.query);
            if (schemas.body) validated.body = schemas.body.parse(req.body);

            res.locals.validated = validated;
            next();
        } catch (err) {
            next(err);
        }
    };
};

/**
 * Type-safe accessor for a validated segment. The caller supplies the same Zod
 * schema used in `validate` so the return type is inferred correctly.
 */
export const getValidated = <S extends ZodTypeAny>(
    res: Response,
    segment: "body" | "query" | "params",
): ZodInfer<S> => {
    const validated = res.locals.validated as
        | Record<string, unknown>
        | undefined;
    return validated?.[segment] as ZodInfer<S>;
};
