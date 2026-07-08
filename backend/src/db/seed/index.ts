import { db, closeDb, roles } from "../index";
import { logger } from "../../utils/logger";

/**
 * Database seed runner.  Run with:  npm run db:seed
 *
 * Design rules for seeds:
 *  - IDEMPOTENT: running it twice must not create duplicates or fail. We rely on
 *    `onConflictDoNothing` against the unique `role_name_idx`.
 *  - REFERENCE DATA ONLY: seeds populate rows the app assumes always exist
 *    (system roles, settings) — never fake/demo business data in this file.
 *  - STANDALONE: it opens no HTTP server; it uses the same `db` singleton and
 *    closes the pool when done so the process can exit.
 */

/** The canonical system roles. Mirrors the `user_role` enum in schema/shared.ts. */
const SYSTEM_ROLES: { name: string; description: string }[] = [
    { name: "MANAGER", description: "Manages teams, approvals and oversight." },
    { name: "VIEWER", description: "Read-only access." },
];

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

async function main(): Promise<void> {
    logger.info("Seeding database...");
    await seedRoles();
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
