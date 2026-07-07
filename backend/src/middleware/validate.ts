import type { RequestHandler } from "express";
import { z, ZodError } from "zod";
import { ValidationError } from "../common/errors";

/**
 * Request validation middleware factory.
 *
 * Usage (Phase 4+):
 *   router.post("/login", validate({ body: loginSchema }), loginController);
 *
 * On success, parsed & coerced values are placed on `req.valid.{body,query,params}`
 * and the request proceeds. On failure, a 422 ValidationError carrying a flat list
 * of field issues is forwarded to the global error handler — one consistent shape.
 */

interface ValidationSchemas {
    body?: z.ZodType;
    query?: z.ZodType;
    params?: z.ZodType;
}

/** Flatten Zod issues into a client-friendly [{ field, message }] list. */
function formatIssues(error: ZodError): { field: string; message: string }[] {
    return error.issues.map((issue) => ({
        field: issue.path.join(".") || "(root)",
        message: issue.message,
    }));
}

export function validate(schemas: ValidationSchemas): RequestHandler {
    return (req, _res, next) => {
        try {
            req.valid ??= {};
            if (schemas.body) req.valid.body = schemas.body.parse(req.body);
            if (schemas.query) req.valid.query = schemas.query.parse(req.query);
            if (schemas.params) req.valid.params = schemas.params.parse(req.params);
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                next(new ValidationError("Validation failed", formatIssues(err)));
                return;
            }
            next(err);
        }
    };
}
