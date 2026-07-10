import { inArray } from "drizzle-orm";
import { db, closeDb, roles, permissions, rolePermissions, userRoles } from "../index";
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

/**
 * The canonical system roles. The LMS is internal to Aan Finance & Investment
 * and serves a handful of staff, so a single operational role is enough today.
 * Additional roles (ADMIN, AUDITOR, CREDIT_MANAGER, COLLECTION_OFFICER) can be
 * added here plus in ROLE_PERMISSIONS without touching the RBAC engine.
 */
const SYSTEM_ROLES: { name: string; description: string }[] = [
    {
        name: "EMPLOYEE",
        description: "Internal employee. Full operational access to the LMS.",
    },
];

/** The canonical permission catalogue (RBAC). Keys are "resource:action". */
const PERMISSIONS: { name: string; description: string }[] = [
    { name: "user:read", description: "View users." },
    { name: "user:write", description: "Create or modify users." },
    { name: "loan:read", description: "View loans." },
    { name: "loan:create", description: "Create loans." },
];

/**
 * Which permissions each role is granted. Keep this the single source of truth
 * for role→permission grants. EMPLOYEE is granted the whole catalogue: every
 * internal user must be able to operate the LMS end to end. Future roles get an
 * explicit subset listed here.
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
    EMPLOYEE: PERMISSIONS.map((p) => p.name),
};

/**
 * Roles that used to be seeded and no longer exist in the business model.
 * Databases seeded before the EMPLOYEE-only model still carry them, so the seed
 * retires them: holders are moved to EMPLOYEE first, then the rows are dropped.
 */
const RETIRED_ROLES = ["MANAGER", "VIEWER"];

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

/**
 * Drop roles that are no longer part of the business model. Runs after the
 * grants so EMPLOYEE is guaranteed to exist and be fully permissioned before
 * anyone is moved onto it. `user_roles.role_id` has no ON DELETE CASCADE, so
 * the memberships must go before the role itself.
 */
async function retireLegacyRoles(): Promise<void> {
    const legacy = await db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(inArray(roles.name, RETIRED_ROLES));

    if (legacy.length === 0) return;

    const [employee] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(inArray(roles.name, ["EMPLOYEE"]));

    if (!employee) throw new Error("EMPLOYEE role missing; cannot retire legacy roles.");

    const legacyIds = legacy.map((r) => r.id);

    // Move every holder of a retired role onto EMPLOYEE. Nobody loses access.
    const holders = await db
        .selectDistinct({ userId: userRoles.userId })
        .from(userRoles)
        .where(inArray(userRoles.roleId, legacyIds));

    if (holders.length > 0) {
        await db
            .insert(userRoles)
            .values(holders.map((h) => ({ userId: h.userId, roleId: employee.id })))
            .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] });
    }

    await db.delete(userRoles).where(inArray(userRoles.roleId, legacyIds));
    // role_permissions.role_id cascades, so the grants go with the role.
    await db.delete(roles).where(inArray(roles.id, legacyIds));

    logger.info(
        `Retired ${legacy.length} legacy role(s): ${legacy.map((r) => r.name).join(", ")}. ` +
            `Migrated ${holders.length} user(s) to EMPLOYEE.`,
    );
}

async function main(): Promise<void> {
    logger.info("Seeding database...");
    await seedRoles();
    await seedPermissions();
    await seedRolePermissions();
    await retireLegacyRoles();
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
