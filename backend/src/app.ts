import express, { type Application } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { corsMiddleware } from "./middleware/cors";
import { requestLogger } from "./middleware/requestLogger";
import { apiRateLimiter } from "./middleware/rateLimit";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter, userRouter } from "./modules/auth";
import { devResetPasswordRouter } from "./dev/resetPasswordPage";
import { interestRouter } from "./modules/interest/interest.routes";
import { repaymentRouter } from "./modules/repayment/repayment.routes";
import { paymentRouter } from "./modules/payment/payment.routes";

/**
 * Builds and returns the Express application.
 *
 * IMPORTANT: this file NEVER calls `app.listen()`. It only assembles the app —
 * middleware, routes, error handling — and hands back a configured `Application`.
 * Binding to a port is `server.ts`'s job. See README / phase notes for why the
 * split matters (testability, reuse, single composition root).
 *
 * Middleware order matters and is intentional:
 *   1. Security / parsing (cors, json)  — prepare every request
 *   2. Routes                            — do the work
 *   3. notFound                          — nothing matched
 *   4. errorHandler                      — funnel all failures out (must be last)
 */
export function createApp(): Application {
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
