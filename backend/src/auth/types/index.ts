/**
 * types/ — shared TypeScript contracts for auth (no runtime code).
 *
 * These DTOs cross layer boundaries: utils produce them, services pass them,
 * controllers/middleware consume them.
 */

/** Claims embedded inside an access-token JWT. */
export interface AccessTokenPayload {
    /** Subject — the user's id. */
    sub: string;
    /** Role names, embedded so RBAC (Phase 5) needs no DB lookup on the hot path. */
    roles: string[];
}

/** A verified access token = our claims plus standard JWT timestamps. */
export interface DecodedAccessToken extends AccessTokenPayload {
    /** Issued-at (epoch seconds). */
    iat: number;
    /** Expiry (epoch seconds). */
    exp: number;
}

/** Identity the authenticate middleware will attach to req.user (later step). */
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

/** The token pair returned by login / refresh (later steps). */
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
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

/** Result of login/refresh: sanitized user + tokens (raw refresh for the cookie). */
export interface LoginResult {
    user: PublicUser;
    accessToken: string;
    refreshToken: string;
}

/**
 * Result of forgotPassword: the RAW reset token to be EMAILED to the user.
 * The controller must email it — it must NEVER be returned in the HTTP response.
 * Undefined when no matching active account exists (caller still responds 200).
 */
export interface ForgotPasswordResult {
    resetToken?: string;
    expiresAt?: Date;
}
