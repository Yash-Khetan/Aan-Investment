import { sql } from "drizzle-orm";

import { createApp } from "./app";
import { env } from "./config/env";
import { db } from "./db/index";

/**
 * Boot sequence:
 *   1. Verify database connectivity (eager SELECT 1) so misconfiguration fails
 *      fast at startup instead of on the first API request. postgres-js itself
 *      connects lazily, so this ping is what actually opens/validates the
 *      connection during boot.
 *   2. Start the HTTP listener only after the DB is reachable.
 */
const start = async (): Promise<void> => {
    try {
        await db.execute(sql`select 1`);
        console.log("Database connected");
    } catch (err) {
        console.error("Database connection failed:", err);
        process.exit(1);
    }

    const app = createApp();
    app.listen(env.PORT, () => {
        console.log(`Server running on port ${env.PORT}`);
    });
};

void start();
