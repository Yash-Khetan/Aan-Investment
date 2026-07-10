/**
 * Shared TypeScript contracts for auth (no runtime code).
 *
 * These DTOs cross layer boundaries: utils produce them, the service passes
 * them, controllers/middleware consume them.
 */

/** Claims embedded inside an access-token JWT. */
export interface AccessTokenPayload {
    /** Subject — the user's id. */
    sub: string;
    /** Role names, embedded so RBAC needs no DB lookup on the hot path. */
    roles: string[];
}

/** A verified access token = our claims plus standard JWT timestamps. */
export interface DecodedAccessToken extends AccessTokenPayload {
    /** Issued-at (epoch seconds). */
    iat: number;
    /** Expiry (epoch seconds). */
    exp: number;
}

/** Identity the authenticate middleware attaches to req.user. */
export interface AuthenticatedUser {
    id: string;
    roles: string[];
}

/** A freshly generated opaque refresh token and the data we persist for it. */
export interface GeneratedRefreshToken {
    /** Raw token — sent to the client (cookie). NEVER stored. */
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

/** Result of login/refresh: sanitized user + tokens (raw refresh for the cookie). */
export interface LoginResult {
    user: PublicUser;
    accessToken: string;
    refreshToken: string;
}
