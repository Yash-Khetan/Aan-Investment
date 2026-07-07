import type { Server } from "node:http";
import { createApp } from "./app";
import { config } from "./config";
import { logger } from "./utils/logger";
import { verifyDbConnection, closeDb } from "./db";

/**
 * Composition root & process entry point.
 *
 * Responsibilities that belong to the PROCESS, not the app:
 *   - verify external dependencies (the database) are reachable
 *   - start listening on a port
 *   - react to OS shutdown signals (SIGTERM/SIGINT) gracefully
 *   - catch otherwise-unhandled crashes so we exit cleanly
 *
 * Importing `config` at the top also triggers env validation immediately —
 * if the environment is misconfigured, we crash HERE, before opening a socket.
 */

let server: Server | undefined;
let shuttingDown = false;

/**
 * Boot sequence. We verify the database FIRST: an app that cannot reach its
 * database should fail fast and loudly, not come up "healthy" and 500 on the
 * first real request.
 */
async function bootstrap(): Promise<void> {
    await verifyDbConnection();
    logger.info("Database connection verified.");

    const app = createApp();

    server = app.listen(config.server.port, () => {
        logger.info(
            `Server listening on port ${config.server.port} [env: ${config.env}]`,
        );
    });
}

/**
 * Graceful shutdown: stop accepting new connections, let in-flight requests
 * finish, then exit. A hard timeout guarantees we never hang forever.
 */
function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.warn(`${signal} received — shutting down gracefully...`);

    // Failsafe: force exit if draining refuses to finish in time.
    const forceTimer = setTimeout(() => {
        logger.error("Graceful shutdown timed out — forcing exit.");
        process.exit(1);
    }, config.server.shutdownTimeoutMs);
    forceTimer.unref();

    // 1) Stop accepting new HTTP connections and let in-flight ones finish.
    // 2) THEN close the DB pool (order matters: never yank the pool from under
    //    a query that is still running).
    const httpServer = server; // capture for narrowing inside the closure
    const stopHttp = () =>
        new Promise<void>((resolve, reject) => {
            if (!httpServer) return resolve();
            httpServer.close((err) => (err ? reject(err) : resolve()));
        });

    stopHttp()
        .then(() => {
            logger.info("HTTP server closed.");
            return closeDb();
        })
        .then(() => {
            logger.info("Database pool closed. Goodbye.");
            process.exit(0);
        })
        .catch((err) => {
            logger.error("Error during shutdown", err);
            process.exit(1);
        });
}

// OS / orchestrator signals (Docker stop, Ctrl+C, deploy rollovers).
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Last-resort safety nets. A process in this state is unreliable — log, then bail.
process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", reason);
    shutdown("unhandledRejection");
});
process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", err);
    shutdown("uncaughtException");
});

// Start the process. If the DB is unreachable, we crash here — by design.
bootstrap().catch((err) => {
    logger.error("Fatal error during startup", err);
    process.exit(1);
});
