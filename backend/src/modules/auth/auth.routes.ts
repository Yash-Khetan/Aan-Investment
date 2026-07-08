import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "./auth.middleware";
import {
    loginSchema,
    refreshSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
} from "./auth.validators";
import * as controller from "./auth.controller";

/**
 * authRouter — mounted at /auth.
 *  POST /login            validate(loginSchema)          → reject bad shape (422)
 *  POST /refresh          validate(refreshSchema)        → optional body token;
 *                         authenticated by the refresh COOKIE, not a JWT
 *  POST /logout           (none)                         → uses the cookie; safe
 *                         to call unauthenticated, idempotent
 *  POST /forgot-password  validate(forgotPasswordSchema) → valid email shape
 *  POST /reset-password   validate(resetPasswordSchema)  → token + strong password
 */
export const authRouter = Router();

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
 *  GET /me   authenticate → PROTECTED: requires a valid access-token JWT.
 */
export const userRouter = Router();

userRouter.get("/me", authenticate, controller.getCurrentUser);
