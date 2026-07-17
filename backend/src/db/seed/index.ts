import { and, eq, inArray, notInArray } from "drizzle-orm";
import {
    db,
    closeDb,
    users,
    roles,
    permissions,
    rolePermissions,
    userRoles,
} from "../index";
import { passwordUtil } from "../../modules/auth";
import { config } from "../../config";
import { logger } from "../../utils/logger";

/**
 * Database seed runner.  Run with:  npm run db:seed
 *
 * Design rules for seeds:
 *  - IDEMPOTENT: running it twice must not create duplicates or fail. We rely on
 *    `onConflictDoNothing` against the relevant unique indexes.
 *  - REFERENCE DATA ONLY: seeds populate rows the app assumes always exist
 *    (system roles, permissions, role→permission grants, the bootstrap admin) —
 *    never fake/demo business data in this file.
 *  - STANDALONE: it opens no HTTP server; it uses the same `db` singleton and
 *    closes the pool when done so the process can exit.
 *
 * This file is the SINGLE SOURCE OF TRUTH for who may do what. The RBAC engine
 * (authorization.service) only reads the graph these tables describe — it knows
 * no role names at all. Introducing a role is a change here and nowhere else.
 */

const ADMIN = "ADMIN";
const EMPLOYEE = "EMPLOYEE";

/**
 * The canonical system roles. The LMS is internal to Aan Finance & Investment:
 * EMPLOYEE is the default every account gets, and exactly one ADMIN account
 * exists to administer them.
 */
const SYSTEM_ROLES: { name: string; description: string }[] = [
    {
        name: ADMIN,
        description: "System administrator. Employee access plus user management.",
    },
    {
        name: EMPLOYEE,
        description: "Internal employee. Day-to-day operational access to the LMS.",
    },
];

/**
 * What every employee needs to operate the LMS day to day. ADMIN inherits all of
 * it — an admin can do anything an employee can.
 */
const EMPLOYEE_PERMISSIONS = ["loan:read", "loan:create"];

/**
 * User management: exactly the capabilities an employee must NOT have. Note the
 * absence of a `user:delete` — accounts are deactivated, never destroyed, so
 * history and audit trails survive.
 */
const ADMIN_PERMISSIONS = [
    "user:read",
    "user:create",
    "user:update",
    "user:activate",
    "user:deactivate",
];

/** The canonical permission catalogue (RBAC). Keys are "resource:action". */
const PERMISSIONS: { name: string; description: string }[] = [
    { name: "user:read", description: "View all users." },
    { name: "user:create", description: "Create user accounts." },
    { name: "user:update", description: "Modify user accounts." },
    { name: "user:activate", description: "Re-enable a deactivated user account." },
    { name: "user:deactivate", description: "Disable a user account." },
    { name: "loan:read", description: "View loans." },
    { name: "loan:create", description: "Create loans." },
];

/**
 * Which permissions each role is granted — the single source of truth for
 * role→permission grants. A role's list here is EXHAUSTIVE: anything not listed
 * is actively revoked on the next seed (see `syncRolePermissions`), so this map
 * describes the live state of the database rather than merely a floor under it.
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
    [ADMIN]: [...EMPLOYEE_PERMISSIONS, ...ADMIN_PERMISSIONS],
    [EMPLOYEE]: EMPLOYEE_PERMISSIONS,
};

/**
 * Roles that used to be seeded and no longer exist in the business model.
 * Databases seeded before the EMPLOYEE-only model still carry them, so the seed
 * retires them: holders are moved to EMPLOYEE first, then the rows are dropped.
 */
const RETIRED_ROLES = ["MANAGER", "VIEWER"];

/**
 * Permissions dropped from the catalogue. `user:write` was one coarse grant
 * covering every user mutation; it is superseded by the finer `user:create`,
 * `user:update`, `user:activate` and `user:deactivate`.
 */
const RETIRED_PERMISSIONS = ["user:write", "user:delete"];

/** The bootstrap administrator. Credentials come from config (SEED_ADMIN_*). */
const ADMIN_USER = {
    firstName: "System",
    lastName: "Administrator",
};

/**
 * Emails that used to be the bootstrap admin. The seed email moved, and a
 * database seeded under an old one still carries an account holding ADMIN —
 * which would leave two administrators, not the one the model allows.
 *
 * Retiring is a DEMOTION, never a delete: the account keeps its row, its
 * history and its login, but loses ADMIN and lands on EMPLOYEE like anyone
 * else. The account named by SEED_ADMIN_EMAIL is skipped, so pointing the seed
 * back at an old address cannot demote the very admin it just created.
 */
const RETIRED_ADMIN_EMAILS = ["admin@gmail.com"];

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

/**
 * Make each managed role's grants match ROLE_PERMISSIONS exactly — GRANT what is
 * listed, REVOKE what is not.
 *
 * The revoke half is what lets a permission be taken away. EMPLOYEE used to hold
 * the entire catalogue, `user:read` included, which meant any employee could list
 * every user. Inserting new grants would never have undone that; only deleting the
 * stale rows does. Roles this seed does not manage are left completely alone.
 */
async function syncRolePermissions(): Promise<void> {
    // Resolve current role + permission ids by their unique names.
    const roleRows = await db.select({ id: roles.id, name: roles.name }).from(roles);
    const permRows = await db
        .select({ id: permissions.id, name: permissions.name })
        .from(permissions);

    const roleId = new Map(roleRows.map((r) => [r.name, r.id]));
    const permId = new Map(permRows.map((p) => [p.name, p.id]));

    const grants: { roleId: string; permissionId: string }[] = [];
    let revoked = 0;

    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
        const rid = roleId.get(role);
        if (!rid) continue;

        const allowedIds = perms
            .map((p) => permId.get(p))
            .filter((id): id is string => id !== undefined);

        for (const pid of allowedIds) grants.push({ roleId: rid, permissionId: pid });

        // Drop anything this role holds that is no longer on its list. An empty
        // allow-list means "revoke everything", which `notInArray` cannot express.
        const stale = await db
            .delete(rolePermissions)
            .where(
                allowedIds.length === 0
                    ? eq(rolePermissions.roleId, rid)
                    : and(
                          eq(rolePermissions.roleId, rid),
                          notInArray(rolePermissions.permissionId, allowedIds),
                      ),
            )
            .returning({ id: rolePermissions.id });

        revoked += stale.length;
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
        `Role-permissions sync complete. Inserted ${result.length} new grant(s); ` +
            `${grants.length - result.length} already existed; ` +
            `revoked ${revoked} stale grant(s).`,
    );
}

/**
 * Create the one administrator account, or leave the existing one exactly as it
 * is. The admin is an ORDINARY user row: same Argon2id hashing, same login path,
 * same session handling. Nothing in the codebase special-cases its email — it is
 * simply the user who happens to hold the ADMIN role.
 *
 * Idempotency has a subtlety worth stating: a re-run never touches an existing
 * admin's password. Re-hashing on every seed would silently reset a password the
 * admin had since changed — and because the seed default is published, that would
 * amount to a standing backdoor.
 */
async function seedAdminUser(): Promise<void> {
    const email = config.seed.adminEmail;
    const password = config.seed.adminPassword;

    // Fail loudly rather than create an account the login policy would reject.
    if (password.length < 8) {
        throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters.");
    }

    if (config.seed.adminPasswordIsDefault) {
        const warning =
            `Seeding admin "${email}" with the DEFAULT published password. ` +
            "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding a real database.";
        if (config.isProduction) throw new Error(warning);
        logger.warn(warning);
    }

    const [adminRole] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, ADMIN))
        .limit(1);

    if (!adminRole) throw new Error(`${ADMIN} role is missing; cannot seed the admin user.`);

    // Look first, so a re-run costs no Argon2 hash and cannot clobber a password.
    // Deliberately NOT filtered by `deleted_at`: `user_email_idx` spans every row,
    // so even a soft-deleted account still owns the email and must be reused
    // rather than duplicated.
    let [admin] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (admin) {
        logger.info(`Admin user seed complete. "${email}" already exists; password untouched.`);
    } else {
        const passwordHash = await passwordUtil.hash(password);

        [admin] = await db
            .insert(users)
            .values({
                firstName: ADMIN_USER.firstName,
                lastName: ADMIN_USER.lastName,
                email,
                passwordHash,
                isEmailVerified: true,
                isActive: true,
            })
            .onConflictDoNothing({ target: users.email })
            .returning({ id: users.id });

        // Lost a race with a concurrent seed — the other run created it. Re-read.
        if (!admin) {
            [admin] = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.email, email))
                .limit(1);
        }

        if (!admin) throw new Error(`Failed to create or resolve the admin user "${email}".`);
        logger.info(`Admin user seed complete. Created "${email}".`);
    }

    // Grant the ADMIN role. Idempotent, and it repairs an admin row whose grant
    // was somehow removed.
    await db
        .insert(userRoles)
        .values({ userId: admin.id, roleId: adminRole.id })
        .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] });
}

/**
 * Demote administrators seeded under a previous SEED_ADMIN_EMAIL, so exactly one
 * ADMIN account survives. Runs AFTER seedAdminUser, so the current admin already
 * exists before any other one loses the role — the database is never left with
 * zero administrators, not even briefly.
 *
 * Idempotent: a second run finds no ADMIN grant left to revoke and does nothing.
 */
async function retireLegacyAdmins(): Promise<void> {
    const current = config.seed.adminEmail;
    const retiring = RETIRED_ADMIN_EMAILS.filter((email) => email !== current);
    if (retiring.length === 0) return;

    const roleRows = await db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(inArray(roles.name, [ADMIN, EMPLOYEE]));

    const roleId = new Map(roleRows.map((r) => [r.name, r.id]));
    const adminRoleId = roleId.get(ADMIN);
    const employeeRoleId = roleId.get(EMPLOYEE);

    if (!adminRoleId || !employeeRoleId) {
        throw new Error(`${ADMIN} or ${EMPLOYEE} role is missing; cannot retire legacy admins.`);
    }

    // Soft-deleted rows included on purpose: the email is theirs either way, and
    // an ADMIN grant on a resurrected account would be a live second admin.
    const legacy = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.email, retiring));

    if (legacy.length === 0) return;

    const legacyIds = legacy.map((u) => u.id);

    const revoked = await db
        .delete(userRoles)
        .where(and(inArray(userRoles.userId, legacyIds), eq(userRoles.roleId, adminRoleId)))
        .returning({ id: userRoles.id });

    if (revoked.length === 0) return;

    // Demoted, not stranded: the account stays usable with ordinary access.
    await db
        .insert(userRoles)
        .values(legacyIds.map((userId) => ({ userId, roleId: employeeRoleId })))
        .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] });

    logger.info(
        `Retired ${revoked.length} legacy admin(s): ${legacy.map((u) => u.email).join(", ")}. ` +
            `Revoked ${ADMIN} and moved them to ${EMPLOYEE}.`,
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
        .where(eq(roles.name, EMPLOYEE))
        .limit(1);

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

/**
 * Drop permissions that have left the catalogue. `role_permissions.permission_id`
 * cascades on delete, so every grant to a retired permission goes with it — no
 * role is left holding a key to a door that no longer exists.
 */
async function retireLegacyPermissions(): Promise<void> {
    const retired = await db
        .delete(permissions)
        .where(inArray(permissions.name, RETIRED_PERMISSIONS))
        .returning({ name: permissions.name });

    if (retired.length === 0) return;

    logger.info(
        `Retired ${retired.length} legacy permission(s): ` +
            `${retired.map((p) => p.name).join(", ")}.`,
    );
}

async function main(): Promise<void> {
    logger.info("Seeding database...");
    await seedRoles();
    await seedPermissions();
    await syncRolePermissions();
    await seedAdminUser();
    await retireLegacyAdmins();
    await retireLegacyRoles();
    await retireLegacyPermissions();
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
