/**
 * Auth module — public surface (barrel).
 *
 * The rest of the application touches auth ONLY through this file: app.ts mounts
 * the routers; future protected feature modules import `authenticate`. Internals
 * (services, repositories, utils) stay private to the module.
 */
export { authRouter, userRouter } from "./routes";
export { authenticate } from "./middleware";
