import type { CookieOptions, Request, Response } from "express";
import { config } from "../../config";
import { REFRESH_COOKIE_NAME } from "../constants";

/**
 * Refresh-token cookie helpers.
 *
 * Why ONLY the refresh token is a cookie (and the access token is not):
 *  - The refresh token is long-lived and powerful, so it must be invisible to
 *    JavaScript (httpOnly) to survive XSS. A cookie scoped to /auth is the safe
 *    home for it — the browser attaches it automatically only to auth calls.
 *  - The access token is short-lived and sent on EVERY API request in the
 *    Authorization header. Keeping it in the response body (client memory)
 *    avoids attaching it to every request as a cookie and sidesteps CSRF for
 *    normal API calls. Short life caps the damage if it leaks.
 *
 * Cookie options explained:
 *  - httpOnly: not readable by document.cookie / JS → mitigates XSS token theft.
 *  - secure:   only sent over HTTPS. TRUE in production; FALSE in dev so it works
 *              over http://localhost.
 *  - sameSite: CSRF control. "lax" in dev (same-site localhost). In production a
 *              browser SPA on a different origin needs "none" so the cookie is
 *              sent cross-site — which the spec requires to be paired with secure.
 *  - path:     "/auth" → the browser only sends this cookie to /auth/* (refresh,
 *              logout), never to the rest of the API. Least exposure.
 *  - maxAge:   lifetime in ms; matches the refresh TTL so the cookie and the DB
 *              session expire together.
 *
 * Dev vs prod: dev = { secure:false, sameSite:"lax" } for http localhost;
 * prod = { secure:true, sameSite:"none" } for HTTPS cross-origin SPAs.
 */

const COOKIE_PATH = "/auth";

function baseOptions(): CookieOptions {
    return {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: config.isProduction ? "none" : "lax",
        path: COOKIE_PATH,
    };
}

/** Set the refresh cookie after login/refresh. */
export function setRefreshCookie(res: Response, rawToken: string): void {
    res.cookie(REFRESH_COOKIE_NAME, rawToken, {
        ...baseOptions(),
        maxAge: config.auth.refreshToken.ttlDays * 24 * 60 * 60 * 1000,
    });
}

/** Clear the refresh cookie on logout. Options must match those used to set it. */
export function clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, baseOptions());
}

/** Read the raw refresh token from the incoming cookie (if present). */
export function readRefreshCookie(req: Request): string | undefined {
    return req.cookies?.[REFRESH_COOKIE_NAME];
}
