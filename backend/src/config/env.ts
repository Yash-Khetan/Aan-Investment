import "dotenv/config";

/**
 * Centralized, validated configuration.
 *
 * Everything the app learns from the environment enters HERE and nowhere else.
 * The rest of the codebase imports `config`, never `process.env` directly.
 *
 * Benefits:
 *  - Single source of truth (no scattered `process.env.X || default`).
 *  - Fail-fast: a malformed env var throws at startup, not mid-request.
 *  - Strong typing: `config.server.port` is a `number`, not `string | undefined`.
 */

type NodeEnv = "development" | "production" | "test";

const VALID_ENVS: readonly NodeEnv[] = ["development", "production", "test"];

/** Read an optional var, falling back to a default. */
function optional(name: string, fallback: string): string {
    const value = process.env[name];
    return value === undefined || value === "" ? fallback : value;
}

/** Parse a string env var into a strict integer, or throw a clear error. */
function toInt(name: string, raw: string): number {
    const n = Number(raw);
    if (!Number.isInteger(n)) {
        throw new Error(
            `Invalid environment variable ${name}: expected an integer, received "${raw}"`,
        );
    }
    return n;
}

/** Read a REQUIRED var, or throw at startup (fail-fast). */
function required(name: string): string {
    const value = process.env[name];
    if (value === undefined || value === "") {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

/** Parse a comma-separated var into a trimmed, de-duped string list. */
function list(name: string): string[] {
    const raw = process.env[name];
    if (!raw) return [];
    return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

const nodeEnvRaw = optional("NODE_ENV", "development");
if (!VALID_ENVS.includes(nodeEnvRaw as NodeEnv)) {
    throw new Error(
        `Invalid NODE_ENV "${nodeEnvRaw}". Expected one of: ${VALID_ENVS.join(", ")}`,
    );
}
const nodeEnv = nodeEnvRaw as NodeEnv;

export const config = {
    env: nodeEnv,
    isProduction: nodeEnv === "production",
    isDevelopment: nodeEnv === "development",
    isTest: nodeEnv === "test",

    app: {
        /**
         * Base URL of the front-end password-reset page. The forgot-password
         * flow appends `?token=…` and emails the resulting link. Configurable
         * via APP_PASSWORD_RESET_URL; defaults to a local dev URL.
         */
        passwordResetUrl: optional("APP_PASSWORD_RESET_URL", "http://localhost:3000/reset-password"),
    },

    server: {
        port: toInt("PORT", optional("PORT", "3000")),
        /** Seconds to allow in-flight requests to drain during shutdown. */
        shutdownTimeoutMs: 10_000,
        /** Trust the first proxy hop in prod (needed for correct client IPs). */
        trustProxy: nodeEnv === "production" ? 1 : false,
    },

    cors: {
        /** Allowed browser origins. Empty = reflect-any in dev, error in prod. */
        origins: list("CORS_ORIGINS"),
    },

    logging: {
        /** Pino level. Verbose in dev, quieter in prod. Override via LOG_LEVEL. */
        level: optional("LOG_LEVEL", nodeEnv === "production" ? "info" : "debug"),
    },

    rateLimit: {
        /** Sliding window length. */
        windowMs: 15 * 60 * 1000, // 15 minutes
        /** Max requests per IP per window (global API limiter). */
        max: 100,
    },

    auth: {
        accessToken: {
            /** HMAC secret that signs access-token JWTs. REQUIRED. */
            secret: required("JWT_ACCESS_SECRET"),
            /** Access-token lifetime, as a jsonwebtoken duration (e.g. "15m"). */
            ttl: optional("JWT_ACCESS_TTL", "15m"),
        },
        refreshToken: {
            /**
             * Refresh tokens are OPAQUE random strings (not JWTs), so there is no
             * signing secret — only a validity window (in days) used to compute
             * the userSessions.expiresAt timestamp.
             */
            ttlDays: toInt("REFRESH_TOKEN_TTL_DAYS", optional("REFRESH_TOKEN_TTL_DAYS", "7")),
        },
    },

    database: {
        /** Full Postgres connection string (Supabase pooler). REQUIRED. */
        url: required("DATABASE_URL"),

        /**
         * TLS. Supabase requires encrypted connections, so "require" always.
         * "require" encrypts but does not verify the CA chain (that is
         * "verify-full"); sufficient for the managed Supabase endpoint.
         */
        ssl: "require" as const,

        /**
         * Max connections in this process's pool. We connect through Supabase's
         * TRANSACTION pooler (PgBouncer on :6543), which multiplexes many app
         * connections onto few real Postgres backends — so keep this modest.
         */
        maxConnections: 10,

        /**
         * MUST be false with the transaction pooler: PgBouncer transaction mode
         * does not support server-side prepared statements.
         */
        usePreparedStatements: false,
    },
} as const;

// Fail-fast: in production, CORS origins must be explicit — never reflect-any.
if (config.isProduction && config.cors.origins.length === 0) {
    throw new Error(
        "CORS_ORIGINS must be set in production (comma-separated allowed origins).",
    );
}

// Fail-fast: a weak JWT secret undermines every access token. Require length.
if (config.auth.accessToken.secret.length < 32) {
    throw new Error(
        "JWT_ACCESS_SECRET must be at least 32 characters (use a long random value).",
    );
}
if (config.auth.refreshToken.ttlDays <= 0) {
    throw new Error("REFRESH_TOKEN_TTL_DAYS must be a positive integer.");
}

export type Config = typeof config;
