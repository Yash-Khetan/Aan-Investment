import cors from "cors";
import { config } from "../config";

/**
 * CORS policy.
 *
 * Controls which browser origins may call this API. Non-browser clients (curl,
 * server-to-server) send no `Origin` header and are always allowed.
 *
 * `credentials: true` lets browsers send cookies/Authorization on cross-origin
 * requests (needed for the Phase 4 auth flow). This is why we must reflect the
 * SPECIFIC origin — the wildcard `*` is illegal together with credentials.
 */

const allowed = config.cors.origins;

export const corsMiddleware = cors({
    origin(origin, callback) {
        // No Origin header → not a browser CORS request. Allow.
        if (!origin) return callback(null, true);

        if (allowed.length === 0) {
            // Dev convenience: reflect any origin. (Prod with no origins is
            // already blocked at config load, so this branch is dev-only.)
            if (!config.isProduction) return callback(null, true);
            return callback(new Error("CORS: no allowed origins configured"));
        }

        if (allowed.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS: origin "${origin}" is not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
});
