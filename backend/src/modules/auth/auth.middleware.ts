import type { RequestHandler } from "express";
import { authService } from "./auth.service";
import { readBearerToken } from "./auth.utils";
import { UnauthorizedError } from "../../common/errors";

/**
 * authenticate — gate for protected routes.
 *
 *  1. Require a `Bearer <token>` Authorization header carrying the opaque
 *     session token issued at login.
 *  2. Validate it against the live session store (signature-less: the token is
 *     not a JWT). authService.authenticateByToken rejects an unknown, expired,
 *     or revoked session and refuses a deleted/deactivated owner.
 *  3. Attach the identity to req.user = { id, roles } (roles read fresh from the
 *     database on each request — this is what RBAC reads).
 *
 * Any failure is forwarded to the global error handler as a 401.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
    try {
        const token = readBearerToken(req);
        if (!token) {
            throw new UnauthorizedError("Missing or malformed Authorization header");
        }
        req.user = await authService.authenticateByToken(token);
        next();
    } catch (err) {
        next(err);
    }
};
