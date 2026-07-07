import {
    userRepository,
    roleRepository,
    sessionRepository,
    passwordResetRepository,
    type UserRecord,
} from "../repositories";
import {
    passwordUtil,
    signAccessToken,
    generateRefreshToken,
    hashRefreshToken,
} from "../utils";
import { randomToken, sha256Hex } from "../../common/crypto";
import {
    UnauthorizedError,
    ForbiddenError,
    BadRequestError,
    NotFoundError,
} from "../../common/errors";
import {
    RESET_TOKEN_BYTES,
    RESET_TOKEN_TTL_MINUTES,
    INVALID_CREDENTIALS_MESSAGE,
} from "../constants";
import type {
    LoginInput,
    ForgotPasswordInput,
    ResetPasswordInput,
} from "../validators";
import type {
    RequestContext,
    PublicUser,
    LoginResult,
    ForgotPasswordResult,
} from "../types";

/** Map a raw DB user row + roles to the safe client projection. */
function toPublicUser(user: UserRecord, roles: string[]): PublicUser {
    return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles,
    };
}

/**
 * AuthService — the use-case layer for authentication.
 *
 * Composes repositories (data) + utils (crypto/JWT). Contains NO SQL and NO
 * HTTP. Dependencies are injected (defaulting to the singletons) so this class
 * is unit-testable with mocks.
 *
 * NOTE on atomicity: some methods perform multiple writes (e.g. create session
 * + stamp last-login). Wrapping them in a DB transaction would require touching
 * Drizzle here, which this layer must not do; that orchestration can be added
 * later behind a repository/unit-of-work abstraction.
 */
export class AuthService {
    constructor(
        private readonly users = userRepository,
        private readonly roles = roleRepository,
        private readonly sessions = sessionRepository,
        private readonly resets = passwordResetRepository,
    ) {}

    /**
     * login — authenticate credentials and start a session.
     * Repos: users.findByEmail, roles.findRoleNamesForUser, sessions.create,
     *        users.updateLastLoginAt.
     * Utils: passwordUtil.verify, signAccessToken, generateRefreshToken.
     * Returns: { user, accessToken, refreshToken(raw) }.
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
     * Repos: sessions.findByTokenHash, sessions.deleteByTokenHash,
     *        users.findById, roles.findRoleNamesForUser, sessions.create.
     * Utils: hashRefreshToken, signAccessToken, generateRefreshToken.
     * Returns: a new { user, accessToken, refreshToken(raw) }.
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
     * Repos: sessions.deleteByTokenHash. Utils: hashRefreshToken.
     * Returns: void.
     */
    async logout(rawRefreshToken: string): Promise<void> {
        const tokenHash = hashRefreshToken(rawRefreshToken);
        await this.sessions.deleteByTokenHash(tokenHash);
    }

    /**
     * forgotPassword — issue a single-use, time-limited reset token.
     * To avoid account enumeration, this reveals nothing: if no active account
     * matches, it returns an empty result and the controller still responds 200.
     * Repos: users.findByEmail, resets.deleteAllForUser, resets.create.
     * Utils: randomToken, sha256Hex.
     * Returns: { resetToken(raw), expiresAt } to be EMAILED (never HTTP-returned),
     *          or {} when there is no matching account.
     */
    async forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordResult> {
        const user = await this.users.findByEmail(input.email);
        if (!user || !user.isActive) return {};

        // Invalidate any previous reset tokens for this user.
        await this.resets.deleteAllForUser(user.id);

        const rawToken = randomToken(RESET_TOKEN_BYTES);
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
        await this.resets.create({
            userId: user.id,
            tokenHash: sha256Hex(rawToken),
            expiresAt,
        });

        return { resetToken: rawToken, expiresAt };
    }

    /**
     * resetPassword — consume a reset token and set a new password, then kill all
     * existing sessions so every device must re-authenticate.
     * Repos: resets.findByTokenHash, users.updatePasswordHash, resets.markUsed,
     *        resets.deleteAllForUser, sessions.deleteAllForUser.
     * Utils: sha256Hex, passwordUtil.hash.
     * Returns: void.
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
     * getCurrentUser — load the sanitized profile behind an authenticated id.
     * Powers GET /users/me; the id comes from the verified access token.
     * Repos: users.findById, roles.findRoleNamesForUser.
     * Returns: PublicUser.
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
