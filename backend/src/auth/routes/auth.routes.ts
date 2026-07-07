import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../middleware";
import {
    loginSchema,
    refreshSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
} from "../validators";
import * as controller from "../controllers";

/**
 * authRouter — mounted at /auth. Middleware per route and WHY:
 *
 *  POST /login            validate(loginSchema)          → reject bad shape (422)
 *                         (public: you can't be logged in yet)
 *  POST /refresh          validate(refreshSchema)        → optional body token;
 *                         (public: authenticated by the refresh COOKIE, not JWT)
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
 *
 *  GET /me   authenticate → PROTECTED: requires a valid access-token JWT.
 *            authenticate sets req.user, which the controller reads.
 */
export const userRouter = Router();

userRouter.get("/me", authenticate, controller.getCurrentUser);
