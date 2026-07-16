import {
    userRepository,
    roleRepository,
    sessionRepository,
    passwordResetRepository,
    isUniqueViolation,
    type UserRecord,
} from "./auth.repository";
import { db as defaultDb } from "../../db";
import {
    passwordUtil,
    signAccessToken,
    generateRefreshToken,
    hashRefreshToken,
} from "./auth.utils";
import { randomToken, sha256Hex } from "../../common/crypto";
import { escapeHtml } from "../../common/html";
import { notificationService } from "../notifications";
import { config } from "../../config";
import { logger } from "../../utils/logger";
import {
    UnauthorizedError,
    ForbiddenError,
    BadRequestError,
    NotFoundError,
    ConflictError,
} from "../../common/errors";
import {
    RESET_TOKEN_BYTES,
    RESET_TOKEN_TTL_MINUTES,
    INVALID_CREDENTIALS_MESSAGE,
    DEFAULT_ROLE_NAME,
    EMAIL_ALREADY_EXISTS_MESSAGE,
    CANNOT_DEACTIVATE_SELF_MESSAGE,
} from "./auth.constants";
import type {
    RegisterInput,
    LoginInput,
    ForgotPasswordInput,
    ResetPasswordInput,
    AdminCreateUserInput,
} from "./auth.validators";
import type {
    RequestContext,
    PublicUser,
    RegisteredUser,
    LoginResult,
} from "./auth.types";

/** Map a raw DB user row + roles to the safe client projection. */
function toPublicUser(user: UserRecord, roles: string[]): PublicUser {
    return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles,
        // The column is nullable (it predates a NOT NULL default), and a NULL
        // there has always meant "not disabled". Normalize once, here.
        isActive: user.isActive ?? true,
    };
}

/**
 * AuthService — the use-case layer for authentication.
 *
 * Composes repositories (data) + utils (crypto/JWT). Contains NO SQL and NO
 * HTTP. Dependencies are injected (defaulting to the singletons) so this class
 * is unit-testable with mocks.
 */
export class AuthService {
    constructor(
        private readonly users = userRepository,
        private readonly roles = roleRepository,
        private readonly sessions = sessionRepository,
        private readonly resets = passwordResetRepository,
        /** Only used to open the registration transaction; all SQL stays in repos. */
        private readonly db = defaultDb,
    ) {}

    /**
     * register — create an account and grant it the default role. Atomic: the
     * user row and its role grant commit together, so a failure can never leave
     * a permission-less orphan account behind.
     *
     * Registration does NOT log the user in — no tokens, no session, no cookie.
     * The client follows up with POST /auth/login.
     *
     * Errors: 409 (email already registered).
     */
    async register(input: RegisterInput): Promise<RegisteredUser> {
        const { user, roleName } = await this.createWithDefaultRole(input);
        return { id: user.id, email: user.email, roles: [roleName] };
    }

    /**
     * createUser — an ADMIN provisions an account for a colleague. Backs
     * POST /users (requires the "user:create" permission).
     *
     * Identical to registration in every way that matters — same validation, same
     * Argon2 hashing, same atomic user+role write, and the same DEFAULT_ROLE_NAME.
     * The admin does NOT choose a role: the payload has no `role` field, so this
     * endpoint cannot mint another admin. Promoting someone stays a deliberate
     * database operation, which is exactly the point.
     *
     * Errors: 409 (email already registered).
     */
    async createUser(input: AdminCreateUserInput): Promise<PublicUser> {
        const { user, roleName } = await this.createWithDefaultRole(input);
        return toPublicUser(user, [roleName]);
    }

    /**
     * The shared account-creation path behind register() and createUser().
     * Atomic: the user row and its role grant commit together, so a failure can
     * never leave a permission-less orphan account behind.
     */
    private async createWithDefaultRole(
        input: RegisterInput | AdminCreateUserInput,
    ): Promise<{ user: UserRecord; roleName: string }> {
        // Fast path: answer the common duplicate case without paying for a hash.
        // Not authoritative on its own — the unique index below closes the race.
        const existing = await this.users.findByEmail(input.email);
        if (existing) throw new ConflictError(EMAIL_ALREADY_EXISTS_MESSAGE);

        // Resolved by NAME, so no role id is ever baked into the code. A missing
        // role means the database was never seeded: a 500 (bug), not a 4xx.
        const role = await this.roles.findByName(DEFAULT_ROLE_NAME);
        if (!role) {
            throw new Error(
                `Default role "${DEFAULT_ROLE_NAME}" is missing. Run the database seed.`,
            );
        }

        const passwordHash = await passwordUtil.hash(input.password);

        try {
            const user = await this.db.transaction(async (tx) => {
                const created = await this.users.withDb(tx).create({
                    firstName: input.firstName,
                    lastName: input.lastName,
                    email: input.email,
                    passwordHash,
                });
                await this.roles.withDb(tx).assignRoleToUser(created.id, role.id);
                return created;
            });

            // Best-effort: a delivery failure must never fail registration itself.
            await this.sendWelcomeEmail(user);

            return { user, roleName:role.name };
        } catch (error) {
            // Two requests for the same email raced past the pre-check, or the
            // email belongs to a soft-deleted account. Either way: 409, not 500.
            if (isUniqueViolation(error)) {
                throw new ConflictError(EMAIL_ALREADY_EXISTS_MESSAGE);
            }
            throw error;
        }
    }

    /** Build and dispatch the welcome email through the notifications module. */
    private async sendWelcomeEmail(user: UserRecord): Promise<void> {
        const safeName = escapeHtml(user.firstName);

        try {
            await notificationService.sendEmail(
                {
                    to: user.email,
                    subject: "Welcome to Aan Investment LMS",
                    text:
                        `Hi ${user.firstName},\n\n` +
                        `Your account has been created. You can sign in any time to get started.\n\n` +
                        `Welcome aboard!`,
                    html:
                        `<p>Hi ${safeName},</p>` +
                        `<p>Your account has been created. You can sign in any time to get started.</p>` +
                        `<p>Welcome aboard!</p>`,
                },
                {
                    userId: user.id,
                    title: "Welcome to Aan Investment LMS",
                    message: "A welcome email was sent after account registration.",
                },
            );
        } catch (error) {
            logger.error("Failed to send welcome email", { err: error, userId: user.id });
        }
    }

    /**
     * setUserActive — an ADMIN enables or disables an account. Backs
     * PATCH /users/:id/activate and /deactivate ("user:activate" / "user:deactivate").
     *
     * Deactivation is our stand-in for deletion: it is reversible and it destroys
     * no history. Two consequences worth knowing:
     *
     *  - Disabling REVOKES every refresh session immediately, so the account
     *    cannot silently keep renewing itself. Its already-issued access token
     *    still works until it expires (≤15m) — access tokens are stateless by
     *    design, and refresh() re-checks `isActive`, so the door shuts on its own.
     *  - An admin may not deactivate THEMSELVES. With a single admin account that
     *    would be an unrecoverable lockout: no one left holding "user:activate".
     *
     * Errors: 400 (self-deactivation); 404 (no such user).
     */
    async setUserActive(
        actorUserId: string,
        targetUserId: string,
        isActive: boolean,
    ): Promise<PublicUser> {
        if (!isActive && actorUserId === targetUserId) {
            throw new BadRequestError(CANNOT_DEACTIVATE_SELF_MESSAGE);
        }

        const user = await this.users.setActive(targetUserId, isActive);
        if (!user) throw new NotFoundError("User not found");

        if (!isActive) {
            await this.sessions.deleteAllForUser(user.id);
        }

        const roles = await this.roles.findRoleNamesForUser(user.id);
        return toPublicUser(user, roles);
    }

    /**
     * login — authenticate credentials and start a session.
     * Errors: 401 (unknown email or wrong password — same message);
     *         403 (account disabled, only revealed after password verifies).
     */
    async login(input: LoginInput, ctx: RequestContext): Promise<LoginResult> {
        const user = await this.users.findByEmail(input.email);
        if (!user) throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);

        const passwordOk = await passwordUtil.verify(user.passwordHash, input.password);
        if (!passwordOk) throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);

        if (!user.isActive) throw new ForbiddenError("Account is disabled");

        const roles = await this.roles.findRoleNamesForUser(user.id);
        const accessToken = signAccessToken({ sub: user.id, roles });
        const refresh = generateRefreshToken();

        await this.sessions.create({
            userId: user.id,
            tokenHash: refresh.tokenHash,
            expiresAt: refresh.expiresAt,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
        });
        await this.users.updateLastLoginAt(user.id);

        return { user: toPublicUser(user, roles), accessToken, refreshToken: refresh.token };
    }

    /**
     * refresh — exchange a valid refresh token for a NEW token pair (rotation).
     * The presented token is invalidated and replaced, so a stolen-and-reused
     * old token cannot yield fresh access.
     * Errors: 401 (unknown/expired token, or user gone/disabled).
     */
    async refresh(rawRefreshToken: string, ctx: RequestContext): Promise<LoginResult> {
        const tokenHash = hashRefreshToken(rawRefreshToken);
        const session = await this.sessions.findByTokenHash(tokenHash);
        if (!session) throw new UnauthorizedError("Invalid refresh token");

        // Expired → clean it up and reject.
        if (session.expiresAt.getTime() <= Date.now()) {
            await this.sessions.deleteByTokenHash(tokenHash);
            throw new UnauthorizedError("Refresh token expired");
        }

        const user = await this.users.findById(session.userId);
        if (!user || !user.isActive) {
            await this.sessions.deleteByTokenHash(tokenHash);
            throw new UnauthorizedError("Invalid refresh token");
        }

        // Rotate: delete the presented token, issue a brand-new one.
        await this.sessions.deleteByTokenHash(tokenHash);

        const roles = await this.roles.findRoleNamesForUser(user.id);
        const accessToken = signAccessToken({ sub: user.id, roles });
        const refresh = generateRefreshToken();

        await this.sessions.create({
            userId: user.id,
            tokenHash: refresh.tokenHash,
            expiresAt: refresh.expiresAt,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
        });

        return { user: toPublicUser(user, roles), accessToken, refreshToken: refresh.token };
    }

    /**
     * logout — end the session tied to the given refresh token. Idempotent:
     * an unknown token is a no-op (still a "successful" logout).
     */
    async logout(rawRefreshToken: string): Promise<void> {
        const tokenHash = hashRefreshToken(rawRefreshToken);
        await this.sessions.deleteByTokenHash(tokenHash);
    }

    /**
     * forgotPassword — issue a single-use, time-limited reset token and email it.
     * To avoid account enumeration, this reveals nothing: if no active account
     * matches it is a silent no-op, and the controller still responds 200.
     * The raw token leaves this process ONLY inside the email body.
     */
    async forgotPassword(input: ForgotPasswordInput): Promise<void> {
        const user = await this.users.findByEmail(input.email);
        if (!user || !user.isActive) return;

        // Invalidate any previous reset tokens for this user.
        await this.resets.deleteAllForUser(user.id);

        const rawToken = randomToken(RESET_TOKEN_BYTES);
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
        await this.resets.create({
            userId: user.id,
            tokenHash: sha256Hex(rawToken),
            expiresAt,
        });

        // Deliver the reset link via the notifications module's email API.
        // Non-blocking: a delivery failure (e.g. SMTP not configured) must not
        // break the enumeration-safe flow, so we log and still succeed.
        await this.sendResetEmail(user, rawToken);
    }

    /** Build and dispatch the password-reset email through the notifications module. */
    private async sendResetEmail(user: UserRecord, rawToken: string): Promise<void> {
        const resetLink = `${config.app.passwordResetUrl}?token=${encodeURIComponent(rawToken)}`;
        const ttlMinutes = RESET_TOKEN_TTL_MINUTES;

        // firstName is user-controlled and reaches an HTML document. Escaping it
        // here keeps `<a href=…>` in the body ours, not the account holder's.
        const safeName = escapeHtml(user.firstName);

        try {
            await notificationService.sendEmail(
                {
                    to: user.email,
                    subject: "Reset your password",
                    text:
                        `Hi ${user.firstName},\n\n` +
                        `We received a request to reset your password. Use the link below to choose a new one. ` +
                        `This link expires in ${ttlMinutes} minutes.\n\n` +
                        `${resetLink}\n\n` +
                        `If you didn't request this, you can safely ignore this email.`,
                    html:
                        `<p>Hi ${safeName},</p>` +
                        `<p>We received a request to reset your password. Use the link below to choose a new one. ` +
                        `This link expires in ${ttlMinutes} minutes.</p>` +
                        `<p><a href="${resetLink}">Reset your password</a></p>` +
                        `<p>If you didn't request this, you can safely ignore this email.</p>`,
                },
                // `message` and `link` are what get PERSISTED. Both are deliberately
                // tokenless: the single-use raw token lives only in the email body
                // above, never in the notifications table.
                {
                    userId: user.id,
                    title: "Password reset requested",
                    message: `A password reset link was emailed to you. It expires in ${ttlMinutes} minutes.`,
                    link: config.app.passwordResetUrl,
                },
            );
        } catch (error) {
            logger.error("Failed to send password-reset email", { err: error, userId: user.id });
        }
    }

    /**
     * resetPassword — consume a reset token and set a new password, then kill all
     * existing sessions so every device must re-authenticate.
     * Errors: 400 (token unknown, already used, or expired).
     */
    async resetPassword(input: ResetPasswordInput): Promise<void> {
        const record = await this.resets.findByTokenHash(sha256Hex(input.token));
        if (!record || record.used || record.expiresAt.getTime() <= Date.now()) {
            throw new BadRequestError("Invalid or expired reset token");
        }

        const newHash = await passwordUtil.hash(input.newPassword);
        await this.users.updatePasswordHash(record.userId, newHash);
        await this.resets.markUsed(record.id);
        await this.resets.deleteAllForUser(record.userId);
        await this.sessions.deleteAllForUser(record.userId);
    }

    /**
     * listUsers — sanitized list of all users. Backs the RBAC-protected
     * GET /users route (requires the "user:read" permission).
     */
    async listUsers(): Promise<PublicUser[]> {
        const rows = await this.users.listAll();
        return Promise.all(
            rows.map(async (u) =>
                toPublicUser(u, await this.roles.findRoleNamesForUser(u.id)),
            ),
        );
    }

    /**
     * getCurrentUser — load the sanitized profile behind an authenticated id.
     * Powers GET /users/me; the id comes from the verified access token.
     * Errors: 404 (user not found / soft-deleted since the token was issued).
     */
    async getCurrentUser(userId: string): Promise<PublicUser> {
        const user = await this.users.findById(userId);
        if (!user) throw new NotFoundError("User not found");
        const roles = await this.roles.findRoleNamesForUser(userId);
        return toPublicUser(user, roles);
    }
}

export const authService = new AuthService();
