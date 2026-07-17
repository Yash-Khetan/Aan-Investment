import rateLimit from "express-rate-limit";
import { config } from "../config";
import { TooManyRequestsError } from "../common/errors";

/**
 * Global API rate limiter — one bucket per client IP.
 *
 * - Emits standard `RateLimit-*` headers (draft-7) so clients can self-throttle.
 * - Exempts /health so orchestrator liveness probes are never throttled.
 * - On breach, forwards a 429 through our error funnel for a consistent shape
 *   (instead of express-rate-limit's default plaintext body).
 *
 * A stricter, route-scoped limiter for sensitive endpoints (e.g. /auth/login)
 * will be added in Phase 4 by reusing this same pattern with a lower `limit`.
 */
export const apiRateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => req.url === "/health",
    handler: (_req, _res, next) =>
        next(new TooManyRequestsError("Too many requests, please try again later.")),
});
