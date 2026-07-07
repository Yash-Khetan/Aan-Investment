import type { RequestHandler } from "express";
import { verifyAccessToken } from "../utils";
import { UnauthorizedError } from "../../common/errors";

/**
 * authenticate — gate for protected routes.
 *
 * Steps:
 *  1. Read the Authorization header and require the `Bearer <token>` scheme.
 *  2. Extract the raw access token.
 *  3. Verify it (signature + expiry) via the JWT util — which throws
 *     UnauthorizedError on any invalid/expired/tampered token.
 *  4. Attach the identity to req.user = { id, roles } (roles come straight from
 *     the token, so no DB hit — this is what RBAC will read in Phase 5).
 *  5. next() into the protected handler.
 *
 * Any failure is forwarded to the global error handler as a 401. This runs
 * per-route (only where mounted), AFTER the global middleware pipeline.
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
