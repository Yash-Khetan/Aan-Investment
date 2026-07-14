/**
 * Auth module — public surface.
 *
 * The rest of the application touches auth ONLY through this file: app.ts mounts
 * the routers; future protected feature modules import `authenticate`. Internals
 * (service, repository, utils) stay private to the module.
 */
export { authRouter, userRouter } from "./auth.routes";
export { authenticate } from "./auth.middleware";
export { authorize, authorizeAny } from "./authorize.middleware";
export { authorizationService } from "./authorization.service";

/**
 * Exported for the database seed, which must hash the bootstrap admin's password
 * with the SAME Argon2id parameters as a registered user — otherwise the admin
 * would be a special case, and the login path would have to know about it. It
 * does not: the admin verifies through the ordinary `passwordUtil.verify`.
 */
export { passwordUtil } from "./auth.utils";
