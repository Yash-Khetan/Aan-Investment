import type { Request } from "express";
import { UnauthorizedError } from "../errors";

/** Who is making this request, and from where — for approval-gating and audit logging. */
export interface RequestActor {
    userId: string;
    isAdmin: boolean;
    ipAddress?: string | null;
    userAgent?: string | null;
}

/** Builds an actor from `req.user` (set by `authenticate`). Throws if the route isn't authenticated. */
export function actorFrom(req: Request): RequestActor {
    if (!req.user) throw new UnauthorizedError("Not authenticated");
    return {
        userId: req.user.id,
        isAdmin: req.user.roles.includes("ADMIN"),
        ipAddress: req.ip ?? null,
        userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
    };
}
