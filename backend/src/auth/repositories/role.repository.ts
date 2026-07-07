import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "../../db";
import { roles, userRoles } from "../../db/schema";

type DB = typeof defaultDb;

/** A row of the `roles` table. */
export type RoleRecord = typeof roles.$inferSelect;

/**
 * RoleRepository — data access for `roles` and the `user_roles` join.
 * No business logic; just reads role data.
 */
export class RoleRepository {
    constructor(private readonly db: DB = defaultDb) {}

    /**
     * Return the ACTIVE role names assigned to a user.
     * Drizzle: SELECT roles.name FROM user_roles
     *          INNER JOIN roles ON roles.id = user_roles.role_id
     *          WHERE user_roles.user_id = $1 AND roles.is_active = true.
     * Called by: AuthService.login (to embed roles in the access token) and the
     * refresh flow (to refresh the roles claim). This is the seam RBAC (Phase 5)
     * depends on.
     */
    async findRoleNamesForUser(userId: string): Promise<string[]> {
        const rows = await this.db
            .select({ name: roles.name })
            .from(userRoles)
            .innerJoin(roles, eq(userRoles.roleId, roles.id))
            .where(and(eq(userRoles.userId, userId), eq(roles.isActive, true)));
        return rows.map((r) => r.name);
    }

    /**
     * Find a single role by its unique name.
     * Drizzle: SELECT * FROM roles WHERE name = $1 LIMIT 1.
     * Called by: a future user/admin service when assigning roles to users.
     */
    async findByName(name: string): Promise<RoleRecord | undefined> {
        const [row] = await this.db
            .select()
            .from(roles)
            .where(eq(roles.name, name))
            .limit(1);
        return row;
    }
}

export const roleRepository = new RoleRepository();
