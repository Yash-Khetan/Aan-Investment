import "dotenv/config";
import { z } from "zod";

/**
 * Centralized, validated environment configuration.
 * The DB client (src/db/index.ts) enforces DATABASE_URL separately at
 * connection time; here we validate process-level runtime settings.
 */
const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    // Fail fast on misconfiguration.
    console.error(
        "Invalid environment configuration:",
        parsed.error.flatten().fieldErrors,
    );
    throw new Error("Invalid environment configuration");
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
