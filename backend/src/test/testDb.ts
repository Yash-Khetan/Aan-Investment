/**
 * A real Postgres for tests, in this process and nowhere else.
 *
 * Tests must never touch a shared database, and the ledger's rules are SQL as
 * much as they are TypeScript — a lock enforced in a WHERE clause, a unique
 * index that makes month-end posting idempotent, a migration that backfills.
 * Asserting those against a mock would prove nothing about them. So each test
 * file gets its own empty PGlite instance (Postgres compiled to WASM, from the
 * `@electric-sql/pglite` dev dependency), migrated with the project's own
 * migration files through the project's own migrator.
 *
 * Nothing here runs outside tests: the application's single pool still lives
 * in src/db/index.ts, and a test file redirects it to this one with
 * `vi.mock("../../db", …)` — see mockDbModule below.
 */

import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "../db/schema";

/** In-memory: created empty, thrown away with the process. */
export const testClient = new PGlite();

export const testDb = drizzle(testClient, { schema });

/** Applies every migration in src/db/migrations, in journal order, exactly as `npm run db:migrate` does. */
export async function migrateTestDb(): Promise<void> {
    await migrate(testDb, { migrationsFolder: "src/db/migrations" });
}

/**
 * Applies named migration files and no others, splitting each on the
 * `--> statement-breakpoint` marker the way the migrator does — for testing
 * what a migration does to a database that already holds data.
 */
export async function applyMigrationFiles(tags: string[]): Promise<void> {
    for (const tag of tags) {
        const file = await readFile(`src/db/migrations/${tag}.sql`, "utf8");
        for (const statement of file.split("--> statement-breakpoint")) {
            if (statement.trim()) await testClient.exec(statement);
        }
    }
}

/**
 * What `vi.mock("../../db", …)` returns: this database behind the same module
 * surface the application imports, schema re-exports included.
 */
export function mockDbModule(): Record<string, unknown> {
    return {
        ...schema,
        db: testDb,
        client: testClient,
        verifyDbConnection: async () => {},
        closeDb: async () => {},
    };
}
