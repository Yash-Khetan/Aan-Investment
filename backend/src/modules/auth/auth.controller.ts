import type { Request, RequestHandler } from "express";
import { authService } from "./auth.service";
import {
    setRefreshCookie,
    clearRefreshCookie,
    readRefreshCookie,
} from "./auth.utils";
import { UnauthorizedError } from "../../common/errors";
import type {
    RegisterInput,
    LoginInput,
    RefreshInput,
    ForgotPasswordInput,
    ResetPasswordInput,
    AdminCreateUserInput,
    UserIdParam,
} from "./auth.validators";
import type { RequestContext } from "./auth.types";

/**
 * Auth controllers — thin HTTP adapters. Each: read validated input / cookie /
 * req.user, call ONE AuthService method, set/clear cookie, send JSON. No logic,
 * no SQL, no JWT, no hashing. Async throws are auto-forwarded to the global
 * error handler by Express 5.
 */

/** Capture request context (IP + user-agent) for the session audit trail. */
function requestContext(req: Request): RequestContext {
    return { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}

export const register: RequestHandler = async (req, res) => {
    const input = req.valid.body as RegisterInput;
    const user = await authService.register(input);
    // 201 + the new resource. No cookie and no access token: registration and
    // login are separate steps, so the client must authenticate explicitly.
    res.status(201).json({ success: true, data: user });
};

export const login: RequestHandler = async (req, res) => {
    const input = req.valid.body as LoginInput;
    const result = await authService.login(input, requestContext(req));
    setRefreshCookie(res, result.refreshToken); // refresh → httpOnly cookie
    res.status(200).json({
        success: true,
        data: { user: result.user, accessToken: result.accessToken }, // access → body
    });
};

export const refresh: RequestHandler = async (req, res) => {
    // Prefer the httpOnly cookie; fall back to a body token for non-browser clients.
    const token =
        readRefreshCookie(req) ?? (req.valid.body as RefreshInput).refreshToken;
    if (!token) throw new UnauthorizedError("Refresh token missing");

    const result = await authService.refresh(token, requestContext(req));
    setRefreshCookie(res, result.refreshToken); // rotated token → new cookie
    res.status(200).json({
        success: true,
        data: { user: result.user, accessToken: result.accessToken },
    });
};

export const logout: RequestHandler = async (req, res) => {
    const token = readRefreshCookie(req);
    if (token) await authService.logout(token); // delete DB session (idempotent)
    clearRefreshCookie(res); // remove the cookie
    res.status(200).json({ success: true, data: { message: "Logged out" } });
};

export const forgotPassword: RequestHandler = async (req, res) => {
    const input = req.valid.body as ForgotPasswordInput;
    // The service issues the token and emails the reset link via the
    // notifications module. Enumeration-safe: always the same generic response,
    // and the raw token is never returned over HTTP.
    await authService.forgotPassword(input);

    res.status(200).json({
        success: true,
        data: {
            message: "If an account exists for that email, a reset link has been sent.",
        },
    });
};

export const resetPassword: RequestHandler = async (req, res) => {
    const input = req.valid.body as ResetPasswordInput;
    await authService.resetPassword(input);
    res.status(200).json({
        success: true,
        data: { message: "Password has been reset. Please log in again." },
    });
};

export const listUsers: RequestHandler = async (_req, res) => {
    const users = await authService.listUsers();
    res.status(200).json({ success: true, data: { users } });
};

export const createUser: RequestHandler = async (req, res) => {
    const input = req.valid.body as AdminCreateUserInput;
    const user = await authService.createUser(input);
    res.status(201).json({ success: true, data: { user } });
};

/**
 * Enable/disable an account. Both handlers are the same call with the flag
 * flipped; the actor's id comes from the verified token, never the body, so the
 * self-deactivation guard in the service cannot be spoofed.
 */
function setActive(isActive: boolean): RequestHandler {
    return async (req, res) => {
        if (!req.user) throw new UnauthorizedError("Not authenticated");
        const { id } = req.valid.params as UserIdParam;
        const user = await authService.setUserActive(req.user.id, id, isActive);
        res.status(200).json({ success: true, data: { user } });
    };
}

export const activateUser = setActive(true);
export const deactivateUser = setActive(false);

export const getCurrentUser: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");
    const user = await authService.getCurrentUser(req.user.id);
    res.status(200).json({ success: true, data: { user } });
};
