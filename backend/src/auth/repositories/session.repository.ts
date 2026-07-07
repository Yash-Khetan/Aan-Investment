import { eq, lt } from "drizzle-orm";
import { db as defaultDb } from "../../db";
import { userSessions } from "../../db/schema";

type DB = typeof defaultDb;

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

/**
 * SessionRepository — data access for `user_sessions` (refresh-token store).
 *
 * IMPORTANT: the `refresh_token` column stores the HASH of the token, never the
 * raw value. Hashing is done in the token util; this layer only persists it.
 */
export class SessionRepository {
    constructor(private readonly db: DB = defaultDb) {}

    /**
     * Persist a new refresh-token session (one row per device/login).
     * Drizzle: INSERT INTO user_sessions (user_id, refresh_token, expires_at,
     *          ip_address, user_agent) VALUES (...) RETURNING *.
     * Called by: AuthService.login and AuthService.refresh (on rotation).
     */
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

    /**
     * Look up a session by the token's hash (refresh/logout).
     * Drizzle: SELECT * FROM user_sessions WHERE refresh_token = $1 LIMIT 1.
     * Called by: AuthService.refresh and AuthService.logout.
     */
    async findByTokenHash(tokenHash: string): Promise<SessionRecord | undefined> {
        const [row] = await this.db
            .select()
            .from(userSessions)
            .where(eq(userSessions.refreshToken, tokenHash))
            .limit(1);
        return row;
    }

    /**
     * Delete a session by token hash (logout / invalidate the old token on rotation).
     * Drizzle: DELETE FROM user_sessions WHERE refresh_token = $1.
     * Called by: AuthService.logout and AuthService.refresh.
     */
    async deleteByTokenHash(tokenHash: string): Promise<void> {
        await this.db
            .delete(userSessions)
            .where(eq(userSessions.refreshToken, tokenHash));
    }

    /**
     * Delete every session for a user (log out all devices; also used after a
     * password reset to force re-login everywhere).
     * Drizzle: DELETE FROM user_sessions WHERE user_id = $1.
     * Called by: AuthService.resetPassword and a "logout all" action.
     */
    async deleteAllForUser(userId: string): Promise<void> {
        await this.db.delete(userSessions).where(eq(userSessions.userId, userId));
    }

    /**
     * Housekeeping: remove expired sessions. Returns the count deleted.
     * Drizzle: DELETE FROM user_sessions WHERE expires_at < $1 RETURNING id.
     * Called by: a future scheduled cleanup job.
     */
    async deleteExpired(now: Date = new Date()): Promise<number> {
        const rows = await this.db
            .delete(userSessions)
            .where(lt(userSessions.expiresAt, now))
            .returning({ id: userSessions.id });
        return rows.length;
    }
}

export const sessionRepository = new SessionRepository();
