import { eq } from "drizzle-orm";
import { db as defaultDb } from "../../db";
import { passwordResetTokens } from "../../db/schema";

type DB = typeof defaultDb;

/** A row of the `password_reset_tokens` table. */
export type PasswordResetRecord = typeof passwordResetTokens.$inferSelect;

/** Input for issuing a reset token. `tokenHash` is the SHA-256 of the raw token. */
export interface CreateResetTokenInput {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
}

/**
 * PasswordResetRepository — data access for `password_reset_tokens`.
 * The `token` column stores the HASH; the raw token is emailed to the user only.
 */
export class PasswordResetRepository {
    constructor(private readonly db: DB = defaultDb) {}

    /**
     * Store a new reset-token record.
     * Drizzle: INSERT INTO password_reset_tokens (user_id, token, expires_at)
     *          VALUES (...) RETURNING *.
     * Called by: AuthService.forgotPassword.
     */
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

    /**
     * Find a reset record by token hash.
     * Drizzle: SELECT * FROM password_reset_tokens WHERE token = $1 LIMIT 1.
     * Called by: AuthService.resetPassword (validity/expiry/used checks happen
     * in the service, not here).
     */
    async findByTokenHash(tokenHash: string): Promise<PasswordResetRecord | undefined> {
        const [row] = await this.db
            .select()
            .from(passwordResetTokens)
            .where(eq(passwordResetTokens.token, tokenHash))
            .limit(1);
        return row;
    }

    /**
     * Mark a reset token as consumed (single-use enforcement).
     * Drizzle: UPDATE password_reset_tokens SET used = true WHERE id = $1.
     * Called by: AuthService.resetPassword after a successful reset.
     */
    async markUsed(id: string): Promise<void> {
        await this.db
            .update(passwordResetTokens)
            .set({ used: true })
            .where(eq(passwordResetTokens.id, id));
    }

    /**
     * Remove all reset tokens for a user (invalidate older tokens when issuing a
     * new one, or clean up after a completed reset).
     * Drizzle: DELETE FROM password_reset_tokens WHERE user_id = $1.
     * Called by: AuthService.forgotPassword / resetPassword.
     */
    async deleteAllForUser(userId: string): Promise<void> {
        await this.db
            .delete(passwordResetTokens)
            .where(eq(passwordResetTokens.userId, userId));
    }
}

export const passwordResetRepository = new PasswordResetRepository();
