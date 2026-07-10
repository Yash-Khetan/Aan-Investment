import { z } from "zod";

/**
 * Zod schemas for auth inputs. Consumed by the generic validate() middleware at
 * the route edge. Each schema also exports its inferred TS type so the service
 * and controllers share one source of truth.
 */

/**
 * Normalize then validate an email:
 *  - preprocess trims surrounding whitespace and lowercases, so "  A@B.com "
 *    and "a@b.com" are treated as the same account (emails are case-insensitive
 *    in practice, and our lookups are exact-match).
 *  - z.email enforces a valid address shape.
 */
const email = z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.email("Invalid email address").max(255, "Email must be at most 255 characters"),
);

/**
 * A person's name: trimmed, non-empty, and within the column width (150).
 * `label` is interpolated into the messages so both name fields read naturally.
 */
const personName = (label: string) =>
    z.preprocess(
        (v) => (typeof v === "string" ? v.trim() : v),
        z
            .string()
            .min(1, `${label} is required`)
            .max(150, `${label} must be at most 150 characters`),
    );

/**
 * Rules for a password we are about to STORE (register / reset). Shared so the
 * policy has exactly one definition:
 *   min 8   → basic brute-force resistance;
 *   max 128 → guard against DoS via absurdly long argon2 inputs;
 *   ≥1 letter and ≥1 number → minimum composition, rejects trivial secrets.
 */
const strongPassword = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters")
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number");

/**
 * REGISTER — create a new account. Names are trimmed, the email is normalized
 * exactly as it is on login (so the two agree on identity), and the password
 * must satisfy the storage policy above.
 */
export const registerSchema = z.object({
    firstName: personName("First name"),
    lastName: personName("Last name"),
    email,
    password: strongPassword,
});
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * LOGIN — email + a non-empty password.
 * We do NOT enforce password complexity on login: the rules may have changed
 * since the account was created, and rejecting here would just leak policy.
 */
export const loginSchema = z.object({
    email,
    password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * REFRESH — the refresh token normally arrives in an httpOnly cookie, so the
 * body is optional (a `refreshToken` field is accepted as a fallback for
 * non-browser clients). The controller will prefer the cookie.
 */
export const refreshSchema = z.object({
    refreshToken: z.string().min(1).optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

/** FORGOT PASSWORD — just a well-formed email; response is always generic. */
export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * RESET PASSWORD — the opaque reset token plus the new password.
 *  - token: required, non-empty (identifies the reset request).
 *  - newPassword: the shared storage policy (see `strongPassword`), enforced
 *    here because this SETS a new credential.
 */
export const resetPasswordSchema = z.object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: strongPassword,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
