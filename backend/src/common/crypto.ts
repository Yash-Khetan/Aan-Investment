import { createHash, randomBytes } from "node:crypto";

/**
 * Generic cryptographic helpers shared by authentication.
 *
 * These are deliberately domain-agnostic (no auth/JWT knowledge) so they live in
 * `common/`. The auth token util composes them into refresh-token logic.
 */

/** Cryptographically-strong URL-safe random token with `bytes` of entropy. */
export function randomToken(bytes: number): string {
    return randomBytes(bytes).toString("base64url");
}

/**
 * Deterministic SHA-256 hex digest. Used to store/look up refresh & reset
 * tokens by their hash — so the raw token never touches the database.
 * (SHA-256, not argon2, because these are already high-entropy random values;
 * they don't need a slow password hash.)
 */
export function sha256Hex(input: string): string {
    return createHash("sha256").update(input).digest("hex");
}
