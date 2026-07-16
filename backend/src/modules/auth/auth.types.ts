/**
 * Shared TypeScript contracts for auth (no runtime code).
 *
 * These DTOs cross layer boundaries: utils produce them, the service passes
 * them, controllers/middleware consume them.
 */

/** Identity the authenticate middleware attaches to req.user. */
export interface AuthenticatedUser {
    id: string;
    roles: string[];
}

/** A freshly generated opaque session token and the data we persist for it. */
export interface GeneratedRefreshToken {
    /** Raw token — returned to the client at login (Bearer credential). NEVER stored. */
    token: string;
    /** SHA-256 hex — stored in userSessions.refreshToken. */
    tokenHash: string;
    /** Absolute expiry — stored in userSessions.expiresAt. */
    expiresAt: Date;
}

/** Per-request context captured onto a session (audit/security trail). */
export interface RequestContext {
    ipAddress?: string | null;
    userAgent?: string | null;
}

/** Safe user projection returned to clients — no password hash, no soft-delete. */
export interface PublicUser {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    roles: string[];
    /**
     * Whether the account may log in. Surfaced so the admin user list shows who
     * is currently disabled — otherwise activate/deactivate would be blind.
     */
    isActive: boolean;
}

/**
 * Result of registration. Deliberately narrower than PublicUser and carries NO
 * tokens: registering does not start a session, the client must call /auth/login.
 */
export interface RegisteredUser {
    id: string;
    email: string;
    roles: string[];
}

/** Result of login: sanitized user + the raw opaque session token (Bearer credential). */
export interface LoginResult {
    user: PublicUser;
    token: string;
}
