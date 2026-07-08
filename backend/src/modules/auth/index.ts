/**
 * Auth module — public surface.
 *
 * The rest of the application touches auth ONLY through this file: app.ts mounts
 * the routers; future protected feature modules import `authenticate`. Internals
 * (service, repository, utils) stay private to the module.
 */
export { authRouter, userRouter } from "./auth.routes";
export { authenticate } from "./auth.middleware";
