import argon2 from "argon2";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { CookieOptions, Request, Response } from "express";
import { config } from "../../config";
import { randomToken, sha256Hex } from "../../common/crypto";
import { UnauthorizedError } from "../../common/errors";
import {
    ARGON2_OPTIONS,
    REFRESH_TOKEN_BYTES,
    REFRESH_COOKIE_NAME,
} from "./auth.constants";
import type {
    AccessTokenPayload,
    DecodedAccessToken,
    GeneratedRefreshToken,
} from "./auth.types";

/* ------------------------------------------------------------------ *
 * Passwords (Argon2id)
 *
 * Argon2 is memory-hard: each guess must spend both time AND large memory,
 * which neuters cheap massively-parallel GPU/ASIC cracking (bcrypt is only
 * CPU-hard). argon2id is the hybrid variant, resistant to GPU and side-channel
 * attacks. The output is a self-describing PHC string embedding the algorithm,
 * parameters and salt, so verify() needs no separate salt column.
 * ------------------------------------------------------------------ */
export const passwordUtil = {
    /** Hash a plaintext password. Returns the encoded PHC string to store. */
    async hash(plain: string): Promise<string> {
        return argon2.hash(plain, ARGON2_OPTIONS);
    },

    /**
     * Verify a plaintext password against a stored hash. Returns false (never
     * throws) on a malformed/unknown hash, so callers get a clean boolean.
     */
    async verify(storedHash: string, plain: string): Promise<boolean> {
        try {
            return await argon2.verify(storedHash, plain);
        } catch {
            return false;
        }
    },
};

/* ------------------------------------------------------------------ *
 * Tokens (JWT access + opaque refresh)
 * ------------------------------------------------------------------ */

const { secret, ttl } = config.auth.accessToken;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sign a short-lived ACCESS TOKEN (JWT). Embeds { sub, roles } + an expiry.
 * Stateless: verified later by signature alone, no DB hit.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
    // jsonwebtoken types `expiresIn` as a branded string union; our config value
    // is a plain string, so cast through unknown.
    const options: SignOptions = {
        expiresIn: ttl as unknown as SignOptions["expiresIn"],
    };
    return jwt.sign(payload, secret, options);
}

/**
 * Verify an ACCESS TOKEN. Returns the decoded claims on success, or throws an
 * UnauthorizedError (401) on a bad/expired/tampered token.
 */
export function verifyAccessToken(token: string): DecodedAccessToken {
    try {
        const decoded = jwt.verify(token, secret);
        if (typeof decoded === "string") {
            throw new Error("Unexpected string JWT payload");
        }
        return decoded as DecodedAccessToken;
    } catch {
        throw new UnauthorizedError("Invalid or expired access token");
    }
}

/**
 * Generate a REFRESH TOKEN. Refresh tokens are OPAQUE random strings, not JWTs.
 * Returns the raw token (goes to the client cookie), its SHA-256 hash (what we
 * persist in userSessions.refreshToken), and the absolute expiry.
 */
export function generateRefreshToken(): GeneratedRefreshToken {
    const token = randomToken(REFRESH_TOKEN_BYTES);
    return {
        token,
        tokenHash: sha256Hex(token),
        expiresAt: new Date(Date.now() + config.auth.refreshToken.ttlDays * DAY_MS),
    };
}

/** Hash a raw refresh token for DB lookup (hash the incoming cookie, match by hash). */
export function hashRefreshToken(token: string): string {
    return sha256Hex(token);
}

/* ------------------------------------------------------------------ *
 * Refresh-token cookie
 *
 * Only the refresh token is a cookie; the access token rides in the response
 * body / Authorization header.
 *  - httpOnly: not readable by JS → mitigates XSS token theft.
 *  - secure:   HTTPS only. TRUE in prod; FALSE in dev for http://localhost.
 *  - sameSite: "lax" in dev (same-site localhost); "none" in prod so a
 *              cross-origin SPA can send it (spec requires pairing with secure).
 *  - path:     "/auth" → the browser only sends it to /auth/* (refresh, logout).
 *  - maxAge:   matches the refresh TTL so cookie and DB session expire together.
 * ------------------------------------------------------------------ */

const COOKIE_PATH = "/auth";

function cookieOptions(): CookieOptions {
    return {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: config.isProduction ? "none" : "lax",
        path: COOKIE_PATH,
    };
}

/** Set the refresh cookie after login/refresh. */
export function setRefreshCookie(res: Response, rawToken: string): void {
    res.cookie(REFRESH_COOKIE_NAME, rawToken, {
        ...cookieOptions(),
        maxAge: config.auth.refreshToken.ttlDays * DAY_MS,
    });
}

/** Clear the refresh cookie on logout. Options must match those used to set it. */
export function clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
}

/** Read the raw refresh token from the incoming cookie (if present). */
export function readRefreshCookie(req: Request): string | undefined {
    return req.cookies?.[REFRESH_COOKIE_NAME];
}
