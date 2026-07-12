/**
 * Auth module — public surface.
 *
 * The rest of the application touches auth ONLY through this file: index.ts mounts
 * the routers; future protected feature modules import `authenticate`. Internals
 * (service, repository, utils) stay private to the module.
 */
export { authRouter, userRouter } from "./auth.routes";
export { authenticate } from "./auth.middleware";
export { authorize, authorizeAny } from "./authorize.middleware";
export { authorizationService } from "./authorization.service";
