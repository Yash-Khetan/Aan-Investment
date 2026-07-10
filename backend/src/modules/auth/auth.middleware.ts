import type { RequestHandler } from "express";
import { verifyAccessToken } from "./auth.utils";
import { UnauthorizedError } from "../../common/errors";

/**
 * authenticate — gate for protected routes.
 *
 *  1. Require the `Bearer <token>` Authorization scheme.
 *  2. Verify the access token (signature + expiry) — throws on anything invalid.
 *  3. Attach the identity to req.user = { id, roles } (roles come straight from
 *     the token, so no DB hit — this is what RBAC reads).
 *
 * Any failure is forwarded to the global error handler as a 401.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return next(new UnauthorizedError("Missing or malformed Authorization header"));
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
        return next(new UnauthorizedError("Missing access token"));
    }

    try {
        const decoded = verifyAccessToken(token);
        req.user = { id: decoded.sub, roles: decoded.roles };
        next();
    } catch (err) {
        next(err);
    }
};
