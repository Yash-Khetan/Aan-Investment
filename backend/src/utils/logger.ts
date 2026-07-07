import pino from "pino";
import { config } from "../config";

/**
 * Application logger — now backed by Pino (fast, structured JSON).
 *
 * The public `logger` interface is UNCHANGED from Phase 1 (`info/warn/error/
 * debug(message, meta?)`), so every existing call site keeps working. Only the
 * engine underneath changed. This is exactly why Phase 1 routed everyone through
 * `logger` instead of `console`.
 *
 * - Development: pretty, colorized output via `pino-pretty`.
 * - Production:  raw JSON on stdout (for log collectors / aggregators).
 *
 * `baseLogger` is the raw Pino instance; `pino-http` reuses it so app logs and
 * request logs share one stream and format.
 */

export const baseLogger = pino({
    level: config.logging.level,
    ...(config.isProduction
        ? {}
        : {
              transport: {
                  target: "pino-pretty",
                  options: {
                      colorize: true,
                      translateTime: "SYS:standard",
                      ignore: "pid,hostname",
                  },
              },
          }),
});

type Level = "debug" | "info" | "warn" | "error";

/** Normalize our `(message, meta?)` calls into Pino's `(mergeObject, message)`. */
function wrap(level: Level) {
    return (message: string, meta?: unknown): void => {
        if (meta === undefined) {
            baseLogger[level](message);
        } else if (meta instanceof Error) {
            baseLogger[level]({ err: meta }, message);
        } else if (typeof meta === "object" && meta !== null) {
            baseLogger[level](meta as Record<string, unknown>, message);
        } else {
            baseLogger[level]({ detail: meta }, message);
        }
    };
}

export const logger = {
    debug: wrap("debug"),
    info: wrap("info"),
    warn: wrap("warn"),
    error: wrap("error"),
};
