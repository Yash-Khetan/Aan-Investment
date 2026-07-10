import { db, closeDb, roles, permissions, rolePermissions } from "../index";
import { logger } from "../../utils/logger";

/**
 * Database seed runner.  Run with:  npm run db:seed
 *
 * Design rules for seeds:
 *  - IDEMPOTENT: running it twice must not create duplicates or fail. We rely on
 *    `onConflictDoNothing` against the relevant unique indexes.
 *  - REFERENCE DATA ONLY: seeds populate rows the app assumes always exist
 *    (system roles, permissions, role→permission grants) — never fake/demo
 *    business data in this file.
 *  - STANDALONE: it opens no HTTP server; it uses the same `db` singleton and
 *    closes the pool when done so the process can exit.
 */

/** The canonical system roles. Mirrors the `user_role` enum in schema/shared.ts. */
const SYSTEM_ROLES: { name: string; description: string }[] = [
    { name: "MANAGER", description: "Manages teams, approvals and oversight." },
    { name: "VIEWER", description: "Read-only access." },
];

/** The canonical permission catalogue (RBAC). Keys are "resource:action". */
const PERMISSIONS: { name: string; description: string }[] = [
    { name: "user:read", description: "View users." },
    { name: "user:write", description: "Create or modify users." },
    { name: "loan:read", description: "View loans." },
    { name: "loan:create", description: "Create loans." },
];

/**
 * Which permissions each role is granted. MANAGER gets everything; VIEWER is
 * read-only. Keep this the single source of truth for role→permission grants.
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
    MANAGER: ["user:read", "user:write", "loan:read", "loan:create"],
    VIEWER: ["user:read", "loan:read"],
};

async function seedRoles(): Promise<void> {
    const result = await db
        .insert(roles)
        .values(
            SYSTEM_ROLES.map((r) => ({
                name: r.name,
                description: r.description,
                isSystemRole: true,
                isActive: true,
            })),
        )
        .onConflictDoNothing({ target: roles.name })
        .returning({ name: roles.name });

    logger.info(
        `Roles seed complete. Inserted ${result.length} new role(s); ` +
            `${SYSTEM_ROLES.length - result.length} already existed.`,
    );
}

async function seedPermissions(): Promise<void> {
    const result = await db
        .insert(permissions)
        .values(PERMISSIONS)
        .onConflictDoNothing({ target: permissions.name })
        .returning({ name: permissions.name });

    logger.info(
        `Permissions seed complete. Inserted ${result.length} new permission(s); ` +
            `${PERMISSIONS.length - result.length} already existed.`,
    );
}

async function seedRolePermissions(): Promise<void> {
    // Resolve current role + permission ids by their unique names.
    const roleRows = await db.select({ id: roles.id, name: roles.name }).from(roles);
    const permRows = await db
        .select({ id: permissions.id, name: permissions.name })
        .from(permissions);

    const roleId = new Map(roleRows.map((r) => [r.name, r.id]));
    const permId = new Map(permRows.map((p) => [p.name, p.id]));

    const grants: { roleId: string; permissionId: string }[] = [];
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
        const rid = roleId.get(role);
        if (!rid) continue;
        for (const perm of perms) {
            const pid = permId.get(perm);
            if (pid) grants.push({ roleId: rid, permissionId: pid });
        }
    }

    if (grants.length === 0) return;

    const result = await db
        .insert(rolePermissions)
        .values(grants)
        .onConflictDoNothing({
            target: [rolePermissions.roleId, rolePermissions.permissionId],
        })
        .returning({ id: rolePermissions.id });

    logger.info(
        `Role-permissions seed complete. Inserted ${result.length} new grant(s); ` +
            `${grants.length - result.length} already existed.`,
    );
}

async function main(): Promise<void> {
    logger.info("Seeding database...");
    await seedRoles();
    await seedPermissions();
    await seedRolePermissions();
    logger.info("Seeding finished successfully.");
}

main()
    .catch((err) => {
        logger.error("Seeding failed", err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDb();
    });
