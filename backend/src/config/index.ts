/**
 * Barrel file for the config module.
 * Import from `../config` everywhere instead of reaching into `../config/env`.
 * This lets us restructure the module internally without touching call sites.
 */
export { config } from "./env";
export type { Config } from "./env";
