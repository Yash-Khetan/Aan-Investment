import type { RequestHandler } from "express";
import { authorizationService } from "./authorization.service";
import { UnauthorizedError, ForbiddenError } from "../../common/errors";

/**
 * authorize — RBAC gate for protected routes. Runs AFTER `authenticate`.
 *
 *   router.get("/users", authenticate, authorize("user:read"), handler);
 *
 * Semantics:
 *   - Reuses `req.user` (populated by `authenticate`) — it does NOT re-parse the
 *     token or duplicate any authentication logic. Authn and authz stay separate.
 *   - Requires ALL listed permissions (logical AND). For OR semantics use
 *     `authorizeAny`.
 *   - Resolves the user's effective permissions from the database on each call
 *     (user_roles → role_permissions → permissions), so a revoked role/permission
 *     takes effect immediately on the user's next request.
 *
 * Responses:
 *   - 401 (UnauthorizedError) — no authenticated user on the request. In normal
 *     wiring `authenticate` already returns 401 first; this is a defensive guard
 *     for a route mistakenly missing `authenticate`.
 *   - 403 (ForbiddenError) — authenticated but missing a required permission.
 */
export function authorize(...required: string[]): RequestHandler {
    return async (req, _res, next) => {
        try {
            if (!req.user) {
                throw new UnauthorizedError("Authentication required");
            }
            const ok = await authorizationService.hasAllPermissions(req.user.id, required);
            if (!ok) {
                throw new ForbiddenError("You do not have permission to perform this action");
            }
            next();
        } catch (err) {
            next(err);
        }
    };
}

/**
 * authorizeAny — like `authorize` but passes if the user holds AT LEAST ONE of
 * the listed permissions (logical OR).
 */
export function authorizeAny(...required: string[]): RequestHandler {
    return async (req, _res, next) => {
        try {
            if (!req.user) {
                throw new UnauthorizedError("Authentication required");
            }
            const ok = await authorizationService.hasAnyPermission(req.user.id, required);
            if (!ok) {
                throw new ForbiddenError("You do not have permission to perform this action");
            }
            next();
        } catch (err) {
            next(err);
        }
    };
}
