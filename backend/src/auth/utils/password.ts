import argon2 from "argon2";
import { ARGON2_OPTIONS } from "../constants";

/**
 * Password hashing utility (Argon2id).
 *
 * How Argon2 works internally (why we chose it):
 *  - It fills a large block of MEMORY with pseudo-random data derived from the
 *    password + a per-hash random SALT, then makes multiple passes mixing that
 *    memory before producing the final tag. Being "memory-hard" means an
 *    attacker must spend both time AND large memory per guess — which is exactly
 *    what neuters cheap, massively-parallel GPU/ASIC cracking (bcrypt is only
 *    CPU-hard). argon2id is the hybrid variant, resistant to both GPU attacks
 *    and side-channel (timing) attacks.
 *  - The output is a self-describing PHC string that embeds the algorithm,
 *    parameters (m/t/p) and the salt, e.g.
 *      $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
 *    so `verify` needs no separate salt column and can adapt if we raise costs.
 */
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
