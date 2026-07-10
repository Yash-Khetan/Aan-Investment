import { randomUUID } from "node:crypto";
import pinoHttp from "pino-http";
import { baseLogger } from "../utils/logger";

/**
 * Per-request logging (pino-http).
 *
 * - Assigns every request a correlation id (`req.id`), reusing an inbound
 *   `x-request-id` if a gateway already set one, else generating a UUID. The id
 *   is echoed back in the response header so clients/logs can be correlated.
 * - Picks a log level from the outcome: 5xx/errors → error, 4xx → warn, else info.
 * - Redacts sensitive headers so tokens/cookies never hit the logs.
 * - Skips /health so liveness probes don't flood the logs.
 */
export const requestLogger = pinoHttp({
    logger: baseLogger,

    genReqId(req, res) {
        const existing = req.headers["x-request-id"];
        const id =
            (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
        res.setHeader("x-request-id", id);
        return id;
    },

    customLogLevel(_req, res, err) {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
    },

    redact: {
        paths: ["req.headers.authorization", "req.headers.cookie"],
        remove: true,
    },

    autoLogging: {
        ignore: (req) => req.url === "/health",
    },
});
