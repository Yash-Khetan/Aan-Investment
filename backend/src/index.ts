import type { Server } from "node:http";
import express, { type Application } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { corsMiddleware } from "./middleware/cors";
import { requestLogger } from "./middleware/requestLogger";
import { apiRateLimiter } from "./middleware/rateLimit";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";
import { verifyDbConnection, closeDb } from "./db";

import { authRouter, userRouter } from "./modules/auth";
import { devResetPasswordRouter } from "./dev/resetPasswordPage";
import { interestRouter } from "./modules/interest/interest.routes";
import { repaymentRouter } from "./modules/repayment/repayment.routes";
import { accountingExportRouter } from "./modules/accounting-export";
import { collateralRouter } from "./modules/collateral";
import { collectionsRouter } from "./modules/collections";
import { documentRouter } from "./modules/document-vault";
import { reportsRouter } from "./modules/reports";
import dashboardRouter from "./modules/dashboard/routes/dashboard.routes.js";
import { lookupRouter } from "./routes/lookup.routes.js";
import apiRouter from "./routes/index";


import { paymentRouter } from "./modules/payment/payment.routes";
import { accountingRouter } from "./modules/accounting/accounting.routes";


/**
 * Single composition root & process entry point.
 *
 * Builds the Express app (middleware, routes, error handling) AND owns the
 * process lifecycle (DB check, listen, graceful shutdown). Kept as one file
 * so there is exactly one place that assembles the API — no risk of a route
 * or middleware existing in one entry point but not another.
 *
 * This is the ONLY entry point (`src/index.ts`) — there is no separate
 * app-builder module to keep in sync.
 *
 * Middleware order is intentional:
 *   1. Security / parsing (helmet, cors, logging, rate limit) — prepare every request
 *   2. Routes                                                  — do the work
 *   3. notFound                                                — nothing matched
 *   4. errorHandler                                             — funnel all failures out (must be last)
 *
 * Importing `config` at the top also triggers env validation immediately —
 * if the environment is misconfigured, we crash HERE, before opening a socket.
 */
function createApp(): Application {
    const app = express();

    // Behind a proxy in prod (Docker/Render/etc.): trust the first hop so
    // req.ip and rate limiting see the real client address, not the proxy's.
    app.set("trust proxy", config.server.trustProxy);

    // Don't advertise the framework.
    app.disable("x-powered-by");

    // (1) Security headers FIRST — must be set before any handler responds.
    app.use(helmet());

    // (2) CORS — answer preflight and gate origins before routing/parsing.
    app.use(corsMiddleware);

    // (3) Request logging — wraps the whole request; assigns req.id early.
    app.use(requestLogger);

    // (4) Rate limiting — shed abusive traffic before parsing/routing.
    app.use(apiRateLimiter);

    // Body parsers.
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // (5) Cookie parser — populates req.cookies (the refresh endpoint reads the
    // httpOnly refresh cookie). Must run before the routes that use it.
    app.use(cookieParser());

    // Liveness probe. Cheap, dependency-free — used by load balancers / Docker.
    app.get("/health", (_req, res) => {
        res.json({
            status: "ok",
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
    });

    // Feature routes.
    app.use("/auth", authRouter); //  /auth/login, /logout, /refresh, /forgot-password, /reset-password
    app.use("/users", userRouter); //  /users/me (protected)

    app.use("/interest-rules", interestRouter); //  POST /, GET /:loanId, POST /:loanId/calculate
    app.use("/repayment-schedules", repaymentRouter); //  POST /, GET /:loanId

    app.use("/payments", paymentRouter); //  POST /
    app.use("/accounting-entries", accountingRouter); //  POST /disbursement, POST /write-off, GET /:loanId

    app.use("/documents", documentRouter);
    app.use("/collateral", collateralRouter);
    app.use("/collections", collectionsRouter);
    app.use("/reports", reportsRouter);
    app.use("/accounting", accountingExportRouter);
    app.use("/dashboard", dashboardRouter);
    app.use("/lookup", lookupRouter);
    app.use("/api/v1", apiRouter); //  /api/v1/borrowers, /api/v1/loans

    // TEMPORARY: renders the page the forgot-password email links to, until a
    // real front-end owns it. Never mounted in production — there the reset URL
    // must point at the front-end, not at this API.
    if (!config.isProduction) {
        app.use(devResetPasswordRouter); //  GET /reset-password, GET /reset-password.js
    }

    // Must come after all routes.
    app.use(notFound);
    app.use(errorHandler);

    return app;
}

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
