import { and, eq, isNull } from "drizzle-orm";
import { db as defaultDb } from "../../db";
import {
    users,
    roles,
    userRoles,
    userSessions,
    passwordResetTokens,
    permissions,
    rolePermissions,
} from "../../db/schema";

/**
 * Auth data-access layer.
 *
 * One repository class per table the auth module owns. `db` is injected
 * (defaults to the singleton) so the service can pass a transaction handle and
 * tests can pass a mock. No business logic lives here — just queries.
 */

/** The Drizzle transaction handle handed to the `db.transaction()` callback. */
type Transaction = Parameters<Parameters<(typeof defaultDb)["transaction"]>[0]>[0];

/** The database executor: the singleton `db` or a transaction handle. */
type DB = typeof defaultDb | Transaction;

/**
 * True when `err` is a Postgres unique-constraint violation (SQLSTATE 23505).
 * Lets the service turn a lost insert race into a clean 409 instead of a 500 —
 * the DB's unique index, not our pre-check, is the real authority.
 */
export function isUniqueViolation(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        (err as { code?: unknown }).code === "23505"
    );
}

/* ------------------------------------------------------------------ *
 * Users
 * ------------------------------------------------------------------ */

/** A row of the `users` table, inferred from the Drizzle schema. */
export type UserRecord = typeof users.$inferSelect;

/** Input for creating a user. `passwordHash` is an argon2id PHC string. */
export interface CreateUserInput {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
}

export class UserRepository {
    constructor(private readonly db: DB = defaultDb) {}

    /** Rebind this repository to a transaction handle (or another executor). */
    withDb(db: DB): UserRepository {
        return new UserRepository(db);
    }

    /**
     * Insert a new user. Throws a unique violation (23505) if the email is
     * already taken — including by a soft-deleted account, since `user_email_idx`
     * spans every row. Callers translate that with `isUniqueViolation`.
     */
    async create(input: CreateUserInput): Promise<UserRecord> {
        const [row] = await this.db.insert(users).values(input).returning();
        return row;
    }

    /** Find a non-deleted user by email (exact match, as stored). */
    async findByEmail(email: string): Promise<UserRecord | undefined> {
        const [row] = await this.db
            .select()
            .from(users)
            .where(and(eq(users.email, email), isNull(users.deletedAt)))
            .limit(1);
        return row;
    }

    /** Find a non-deleted user by id. */
    async findById(id: string): Promise<UserRecord | undefined> {
        const [row] = await this.db
            .select()
            .from(users)
            .where(and(eq(users.id, id), isNull(users.deletedAt)))
            .limit(1);
        return row;
    }

    /** List all non-deleted users (admin capability; guarded by RBAC). */
    async listAll(): Promise<UserRecord[]> {
        return this.db
            .select()
            .from(users)
            .where(isNull(users.deletedAt));
    }

    /** Stamp the last successful login time. */
    async updateLastLoginAt(userId: string, when: Date = new Date()): Promise<void> {
        await this.db
            .update(users)
            .set({ lastLoginAt: when, updatedAt: when })
            .where(eq(users.id, userId));
    }

    /** Replace a user's password hash (used by the reset-password flow). */
    async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
        await this.db
            .update(users)
            .set({ passwordHash, updatedAt: new Date() })
            .where(eq(users.id, userId));
    }
}

export const userRepository = new UserRepository();

/* ------------------------------------------------------------------ *
 * Roles
 * ------------------------------------------------------------------ */

/** A row of the `roles` table. */
export type RoleRecord = typeof roles.$inferSelect;

export class RoleRepository {
    constructor(private readonly db: DB = defaultDb) {}

    /** Rebind this repository to a transaction handle (or another executor). */
    withDb(db: DB): RoleRepository {
        return new RoleRepository(db);
    }

    /**
     * Look a role up by its unique name. Used to resolve the default role at
     * registration time so no role id is ever hardcoded in the codebase.
     */
    async findByName(name: string): Promise<RoleRecord | undefined> {
        const [row] = await this.db
            .select()
            .from(roles)
            .where(and(eq(roles.name, name), eq(roles.isActive, true)))
            .limit(1);
        return row;
    }

    /** Grant a role to a user. Idempotent: a re-grant is a no-op. */
    async assignRoleToUser(userId: string, roleId: string): Promise<void> {
        await this.db
            .insert(userRoles)
            .values({ userId, roleId })
            .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] });
    }

    /**
     * Return the ACTIVE role names assigned to a user. Called on login/refresh
     * to embed roles in the access token — the seam RBAC depends on.
     */
    async findRoleNamesForUser(userId: string): Promise<string[]> {
        const rows = await this.db
            .select({ name: roles.name })
            .from(userRoles)
            .innerJoin(roles, eq(userRoles.roleId, roles.id))
            .where(and(eq(userRoles.userId, userId), eq(roles.isActive, true)));
        return rows.map((r) => r.name);
    }
}

export const roleRepository = new RoleRepository();

/* ------------------------------------------------------------------ *
 * Permissions (RBAC)
 *
 * Resolves the effective permission set for a user by walking
 *   user_roles → roles (active only) → role_permissions → permissions.
 * This is the data seam the authorization layer reads. No business logic.
 * ------------------------------------------------------------------ */

/** A row of the `permissions` table. */
export type PermissionRecord = typeof permissions.$inferSelect;

export class PermissionRepository {
    constructor(private readonly db: DB = defaultDb) {}

    /**
     * Return the DISTINCT permission names granted to a user through all of
     * their ACTIVE roles. Empty array if the user has no roles/permissions.
     */
    async findPermissionNamesForUser(userId: string): Promise<string[]> {
        const rows = await this.db
            .selectDistinct({ name: permissions.name })
            .from(userRoles)
            .innerJoin(roles, eq(userRoles.roleId, roles.id))
            .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
            .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
            .where(and(eq(userRoles.userId, userId), eq(roles.isActive, true)));
        return rows.map((r) => r.name);
    }
}

export const permissionRepository = new PermissionRepository();

/* ------------------------------------------------------------------ *
 * Sessions (refresh-token store)
 *
 * IMPORTANT: the `refresh_token` column stores the HASH of the token, never the
 * raw value. Hashing happens in auth.utils; this layer only persists it.
 * ------------------------------------------------------------------ */

/** A row of the `user_sessions` table. */
export type SessionRecord = typeof userSessions.$inferSelect;

/** Input for creating a session. `tokenHash` is the SHA-256 of the raw token. */
export interface CreateSessionInput {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
}

export class SessionRepository {
    constructor(private readonly db: DB = defaultDb) {}

    /** Persist a new refresh-token session (one row per device/login). */
    async create(input: CreateSessionInput): Promise<SessionRecord> {
        const [row] = await this.db
            .insert(userSessions)
            .values({
                userId: input.userId,
                refreshToken: input.tokenHash,
                expiresAt: input.expiresAt,
                ipAddress: input.ipAddress ?? null,
                userAgent: input.userAgent ?? null,
            })
            .returning();
        return row;
    }

    /** Look up a session by the token's hash (refresh/logout). */
    async findByTokenHash(tokenHash: string): Promise<SessionRecord | undefined> {
        const [row] = await this.db
            .select()
            .from(userSessions)
            .where(eq(userSessions.refreshToken, tokenHash))
            .limit(1);
        return row;
    }

    /** Delete a session by token hash (logout / invalidate the old token on rotation). */
    async deleteByTokenHash(tokenHash: string): Promise<void> {
        await this.db
            .delete(userSessions)
            .where(eq(userSessions.refreshToken, tokenHash));
    }

    /**
     * Delete every session for a user (also used after a password reset to force
     * re-login on every device).
     */
    async deleteAllForUser(userId: string): Promise<void> {
        await this.db.delete(userSessions).where(eq(userSessions.userId, userId));
    }
}

export const sessionRepository = new SessionRepository();

/* ------------------------------------------------------------------ *
 * Password reset tokens
 *
 * The `token` column stores the HASH; the raw token is emailed to the user only.
 * ------------------------------------------------------------------ */

/** A row of the `password_reset_tokens` table. */
export type PasswordResetRecord = typeof passwordResetTokens.$inferSelect;

/** Input for issuing a reset token. `tokenHash` is the SHA-256 of the raw token. */
export interface CreateResetTokenInput {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
}

export class PasswordResetRepository {
    constructor(private readonly db: DB = defaultDb) {}

    /** Store a new reset-token record. */
    async create(input: CreateResetTokenInput): Promise<PasswordResetRecord> {
        const [row] = await this.db
            .insert(passwordResetTokens)
            .values({
                userId: input.userId,
                token: input.tokenHash,
                expiresAt: input.expiresAt,
            })
            .returning();
        return row;
    }

    /** Find a reset record by token hash (validity checks happen in the service). */
    async findByTokenHash(tokenHash: string): Promise<PasswordResetRecord | undefined> {
        const [row] = await this.db
            .select()
            .from(passwordResetTokens)
            .where(eq(passwordResetTokens.token, tokenHash))
            .limit(1);
        return row;
    }

    /** Mark a reset token as consumed (single-use enforcement). */
    async markUsed(id: string): Promise<void> {
        await this.db
            .update(passwordResetTokens)
            .set({ used: true })
            .where(eq(passwordResetTokens.id, id));
    }

    /** Remove all reset tokens for a user (on re-issue or after a completed reset). */
    async deleteAllForUser(userId: string): Promise<void> {
        await this.db
            .delete(passwordResetTokens)
            .where(eq(passwordResetTokens.userId, userId));
    }
}

export const passwordResetRepository = new PasswordResetRepository();
