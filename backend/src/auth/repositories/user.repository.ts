import { and, eq, isNull } from "drizzle-orm";
import { db as defaultDb } from "../../db";
import { users } from "../../db/schema";

/** The database executor: the singleton `db` or a transaction handle. */
type DB = typeof defaultDb;

/** A row of the `users` table, inferred from the Drizzle schema. */
export type UserRecord = typeof users.$inferSelect;

/**
 * UserRepository — data access for the `users` table.
 *
 * `db` is injected (defaults to the singleton) so services can pass a
 * transaction handle, and tests can pass a mock. No business logic here.
 */
export class UserRepository {
    constructor(private readonly db: DB = defaultDb) {}

    /**
     * Find a non-deleted user by email (case-sensitive, as stored).
     * Drizzle: SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1.
     * Called by: AuthService.login (to look up the account to authenticate) and
     * the forgot-password flow.
     */
    async findByEmail(email: string): Promise<UserRecord | undefined> {
        const [row] = await this.db
            .select()
            .from(users)
            .where(and(eq(users.email, email), isNull(users.deletedAt)))
            .limit(1);
        return row;
    }

    /**
     * Find a non-deleted user by id.
     * Drizzle: SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1.
     * Called by: AuthService (GET /users/me) and the refresh flow to load the
     * current user behind a session.
     */
    async findById(id: string): Promise<UserRecord | undefined> {
        const [row] = await this.db
            .select()
            .from(users)
            .where(and(eq(users.id, id), isNull(users.deletedAt)))
            .limit(1);
        return row;
    }

    /**
     * Stamp the last successful login time.
     * Drizzle: UPDATE users SET last_login_at = $2, updated_at = $2 WHERE id = $1.
     * Called by: AuthService.login after credentials verify.
     */
    async updateLastLoginAt(userId: string, when: Date = new Date()): Promise<void> {
        await this.db
            .update(users)
            .set({ lastLoginAt: when, updatedAt: when })
            .where(eq(users.id, userId));
    }

    /**
     * Replace a user's password hash (used by the reset-password flow).
     * Drizzle: UPDATE users SET password_hash = $2, updated_at = now WHERE id = $1.
     * Called by: AuthService.resetPassword (after a valid reset token).
     */
    async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
        await this.db
            .update(users)
            .set({ passwordHash, updatedAt: new Date() })
            .where(eq(users.id, userId));
    }
}

/** Ready-to-use singleton bound to the default db. */
export const userRepository = new UserRepository();
