import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        /**
         * The database-backed suites each bring up their own Postgres (PGlite,
         * compiled to WASM — see src/test/testDb.ts) and apply every migration
         * before their first test. Starting several at once takes longer than
         * vitest's 10-second default for a hook, so both limits are raised.
         * The pure suites are unaffected: a timeout only matters when reached.
         */
        hookTimeout: 120_000,
        testTimeout: 30_000,
    },
});
