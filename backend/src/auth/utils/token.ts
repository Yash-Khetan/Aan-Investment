import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../../config";
import { randomToken, sha256Hex } from "../../common/crypto";
import { UnauthorizedError } from "../../common/errors";
import { REFRESH_TOKEN_BYTES } from "../constants";
import type {
    AccessTokenPayload,
    DecodedAccessToken,
    GeneratedRefreshToken,
} from "../types";

const { secret, ttl } = config.auth.accessToken;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sign a short-lived ACCESS TOKEN (JWT).
 * Embeds { sub, roles } + an expiry. Stateless: verified later by signature
 * alone, no DB hit. Used by the Login and Refresh services (later steps).
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
 * UnauthorizedError (401) on a bad/expired/tampered token. Used by the
 * authenticate middleware (later step).
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
 * persist in userSessions.refreshToken), and the absolute expiry. Used by the
 * Login and Refresh services (later steps).
 */
export function generateRefreshToken(): GeneratedRefreshToken {
    const token = randomToken(REFRESH_TOKEN_BYTES);
    return {
        token,
        tokenHash: sha256Hex(token),
        expiresAt: new Date(Date.now() + config.auth.refreshToken.ttlDays * DAY_MS),
    };
}

/**
 * Hash a raw refresh token for DB lookup on the refresh endpoint (later step):
 * we hash the incoming cookie value and find the session by matching hash.
 */
export function hashRefreshToken(token: string): string {
    return sha256Hex(token);
}
