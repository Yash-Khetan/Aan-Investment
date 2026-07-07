import argon2, { type Options } from "argon2";

/**
 * Static auth constants (non-secret, non-environment). Env-derived values live
 * in config; these are fixed tuning parameters and names.
 */

/**
 * Argon2id parameters (OWASP-aligned, memory-hard).
 *  - type argon2id: hybrid resistant to both GPU and side-channel attacks.
 *  - memoryCost 19456 KiB (~19 MiB): the memory each hash must allocate; the
 *    lever that defeats GPU/ASIC farms.
 *  - timeCost 2: number of passes over memory.
 *  - parallelism 1: independent lanes.
 */
export const ARGON2_OPTIONS: Options = {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
};

/** Entropy for opaque refresh tokens. 48 bytes = 384 bits. */
export const REFRESH_TOKEN_BYTES = 48;

/** Name of the httpOnly cookie that will carry the refresh token (later step). */
export const REFRESH_COOKIE_NAME = "lms_refresh_token";

/** Entropy (bytes) for opaque password-reset tokens. 32 bytes = 256 bits. */
export const RESET_TOKEN_BYTES = 32;

/** Password-reset token validity window, in minutes. */
export const RESET_TOKEN_TTL_MINUTES = 30;

/** Generic credential error message — identical for unknown email OR bad
 *  password, so attackers can't enumerate which accounts exist. */
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";
