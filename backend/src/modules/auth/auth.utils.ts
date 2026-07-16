import argon2 from "argon2";
import type { Request } from "express";
import { config } from "../../config";
import { randomToken, sha256Hex } from "../../common/crypto";
import { ARGON2_OPTIONS, REFRESH_TOKEN_BYTES } from "./auth.constants";
import type { GeneratedRefreshToken } from "./auth.types";

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
 * Session tokens (opaque, server-side)
 *
 * The token issued at login IS the credential — clients present it as a Bearer
 * token on every request. It is an OPAQUE random string (not a JWT): we store
 * only its SHA-256 hash in userSessions.refreshToken and validate each request
 * against that row, so authentication is fully revocable server-side.
 * ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a SESSION TOKEN. Returns the raw token (returned to the client at
 * login), its SHA-256 hash (persisted in userSessions.refreshToken), and the
 * absolute expiry.
 */
export function generateRefreshToken(): GeneratedRefreshToken {
    const token = randomToken(REFRESH_TOKEN_BYTES);
    return {
        token,
        tokenHash: sha256Hex(token),
        expiresAt: new Date(Date.now() + config.auth.refreshToken.ttlDays * DAY_MS),
    };
}

/** Hash a raw session token for DB lookup (hash the presented token, match by hash). */
export function hashRefreshToken(token: string): string {
    return sha256Hex(token);
}

/**
 * Read the raw session token from a `Bearer <token>` Authorization header.
 * Returns undefined when the header is absent, malformed, or carries no token.
 */
export function readBearerToken(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) return undefined;
    const token = header.slice("Bearer ".length).trim();
    return token || undefined;
}
