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

/** Entropy for opaque session tokens. 48 bytes = 384 bits. */
export const REFRESH_TOKEN_BYTES = 48;

/** Entropy (bytes) for opaque password-reset tokens. 32 bytes = 256 bits. */
export const RESET_TOKEN_BYTES = 32;

/** Password-reset token validity window, in minutes. */
export const RESET_TOKEN_TTL_MINUTES = 30;

/** Generic credential error message — identical for unknown email OR bad
 *  password, so attackers can't enumerate which accounts exist. */
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

/**
 * Role granted to every account this API creates — whether the user registered
 * themselves or an admin created them. Resolved to an id at runtime through the
 * role repository (never hardcoded), and seeded by db/seed.
 *
 * There is deliberately no way to ask for a different role over HTTP: neither
 * the register nor the admin-create payload carries a `role` field, so a role
 * can only ever be granted by the seed or by direct database access. That is
 * what closes the privilege-escalation door.
 */
export const DEFAULT_ROLE_NAME = "EMPLOYEE";

/** 409 message for a registration against an email that already exists. */
export const EMAIL_ALREADY_EXISTS_MESSAGE = "Email already exists";

/**
 * 400 message when an admin tries to deactivate themselves. There is exactly one
 * admin account, so letting it disable itself would lock the organisation out of
 * every user-management endpoint with no way back in through the API.
 */
export const CANNOT_DEACTIVATE_SELF_MESSAGE = "You cannot deactivate your own account";
