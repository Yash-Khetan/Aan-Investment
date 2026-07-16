/**
 * Ambient type augmentation for Express.
 *
 * - `req.valid`: parsed/typed input written by validate() (Express 5 makes
 *   req.query read-only, so we don't mutate it).
 * - `req.user`: the authenticated identity attached by the authenticate
 *   middleware after a valid session token. Undefined on public routes.
 */
import type { AuthenticatedUser } from "../modules/auth/auth.types";

declare global {
    namespace Express {
        interface Request {
            valid: {
                body?: unknown;
                query?: unknown;
                params?: unknown;
            };
            user?: AuthenticatedUser;
        }
    }
}

export {};
