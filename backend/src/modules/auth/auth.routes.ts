import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "./auth.middleware";
import { authorize } from "./authorize.middleware";
import {
    registerSchema,
    loginSchema,
    refreshSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    adminCreateUserSchema,
    userIdParamSchema,
} from "./auth.validators";
import * as controller from "./auth.controller";

/**
 * authRouter — mounted at /auth.
 *  POST /register         validate(registerSchema)       → names + email + strong
 *                         password. Creates the account only; issues NO tokens.
 *  POST /login            validate(loginSchema)          → reject bad shape (422)
 *  POST /refresh          validate(refreshSchema)        → optional body token;
 *                         authenticated by the refresh COOKIE, not a JWT
 *  POST /logout           (none)                         → uses the cookie; safe
 *                         to call unauthenticated, idempotent
 *  POST /forgot-password  validate(forgotPasswordSchema) → valid email shape
 *  POST /reset-password   validate(resetPasswordSchema)  → token + strong password
 */
export const authRouter = Router();

authRouter.post("/register", validate({ body: registerSchema }), controller.register);
authRouter.post("/login", validate({ body: loginSchema }), controller.login);
authRouter.post("/refresh", validate({ body: refreshSchema }), controller.refresh);
authRouter.post("/logout", controller.logout);
authRouter.post(
    "/forgot-password",
    validate({ body: forgotPasswordSchema }),
    controller.forgotPassword,
);
authRouter.post(
    "/reset-password",
    validate({ body: resetPasswordSchema }),
    controller.resetPassword,
);

/**
 * userRouter — mounted at /users.
 *
 * `/me` is the only route here open to every authenticated user. The rest are
 * user MANAGEMENT, and the seed grants their permissions to ADMIN alone — so an
 * EMPLOYEE's access token gets a 403 from `authorize`, not a 401. Nothing in
 * this file names a role: the guards ask for permissions, and the seed decides
 * who holds them. Adding a second privileged role later needs no change here.
 *
 *  GET   /me                 authenticate                → any authenticated user.
 *  GET   /                   authorize("user:read")      → list all users.
 *  POST  /                   authorize("user:create")    → provision an account.
 *  PATCH /:id/activate       authorize("user:activate")  → re-enable an account.
 *  PATCH /:id/deactivate     authorize("user:deactivate")→ disable an account.
 *
 * There is deliberately no DELETE: accounts are disabled, never destroyed.
 */
export const userRouter = Router();

userRouter.get("/me", authenticate, controller.getCurrentUser);

userRouter.get("/", authenticate, authorize("user:read"), controller.listUsers);

userRouter.post(
    "/",
    authenticate,
    authorize("user:create"),
    validate({ body: adminCreateUserSchema }),
    controller.createUser,
);

userRouter.patch(
    "/:id/activate",
    authenticate,
    authorize("user:activate"),
    validate({ params: userIdParamSchema }),
    controller.activateUser,
);

userRouter.patch(
    "/:id/deactivate",
    authenticate,
    authorize("user:deactivate"),
    validate({ params: userIdParamSchema }),
    controller.deactivateUser,
);
