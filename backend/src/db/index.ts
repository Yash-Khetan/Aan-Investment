import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { config } from "../config";
import * as schema from "./schema";

/**
 * THE single database entry point for the entire application.
 *
 * Nothing else in the codebase may call `postgres()` or `drizzle()`. Every
 * repository, service, and script imports `db` (and, rarely, `client`) from
 * here. One process = one connection pool.
 *
 * Two layers:
 *   - `client`  → the low-level `postgres-js` driver (raw SQL, owns the pool).
 *   - `db`      → the Drizzle ORM instance wrapping `client`, bound to our full
 *                 `schema` so queries are fully typed and relational helpers work.
 *
 * Dev-safety: `tsx watch` reloads modules on every save. Without a guard, each
 * reload would open a NEW pool and slowly exhaust the database's connection
 * budget. We cache the singletons on `globalThis` so reloads reuse one pool.
 */

type DbGlobal = {
    __lms_pg_client?: ReturnType<typeof postgres>;
};

const globalForDb = globalThis as unknown as DbGlobal;

export const client =
    globalForDb.__lms_pg_client ??
    postgres(config.database.url, {
        ssl: config.database.ssl,
        max: config.database.maxConnections,
        prepare: config.database.usePreparedStatements,
    });

if (!config.isProduction) {
    globalForDb.__lms_pg_client = client;
}

/** Fully-typed Drizzle instance. Import THIS in repositories. */
export const db = drizzle(client, { schema });

/** Re-export the schema so callers can do `import { db, users } from "../db"`. */
export * from "./schema";

/**
 * Lightweight connectivity check. Called once at startup so a bad DB config
 * fails the boot loudly instead of surfacing as a 500 on the first request.
 */
export async function verifyDbConnection(): Promise<void> {
    await db.execute(sql`select 1`);
}

/**
 * Close the pool during graceful shutdown. `index.ts` calls this after the
 * HTTP server stops accepting connections, so we never yank the pool out from
 * under an in-flight query.
 */
export async function closeDb(): Promise<void> {
    await client.end({ timeout: 5 });
}
