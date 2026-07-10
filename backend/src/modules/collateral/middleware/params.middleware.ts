import type { RequestHandler } from "express";
import { assertValidUuid } from "../validators/collateral.validators";
import { mapErrorToHttpResponse } from "../utils/http-error-mapper";

/**
 * Validates that `req.params[paramName]` is a well-formed UUID before the
 * request reaches a controller, so route handlers never have to guard
 * against a malformed id themselves.
 */
export function validateUuidParam(paramName: string): RequestHandler {
    return (req, res, next) => {
        try {
            assertValidUuid(String(req.params[paramName]), paramName);
            next();
        } catch (error) {
            mapErrorToHttpResponse(res, error);
        }
    };
}
