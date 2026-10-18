import { Router, type RequestHandler } from "express";
import { ForbiddenError } from "../../common/errors";
import * as controller from "./notification.controller";

export const requireAdmin: RequestHandler = (req, _res, next) => {
    if (!req.user || !req.user.roles?.includes("ADMIN")) {
        return next(new ForbiddenError("Access restricted to administrators only"));
    }
    next();
};

/**
 * Lazy wrapper around `authenticate` to avoid an ES-module TDZ circular
 * dependency error.  The real `authenticate` handler is only imported and
 * called when an HTTP request arrives — by which time every module is fully
 * initialised — rather than at module-evaluation time when the binding may
 * still be `undefined`.
 */
const lazyAuthenticate: RequestHandler = async (req, res, next) => {
    const { authenticate } = await import("../auth/auth.middleware");
    return authenticate(req, res, next);
};

export const notificationRouter = Router();

// All notification management endpoints require authentication and ADMIN role
notificationRouter.use(lazyAuthenticate, requireAdmin);

notificationRouter.get("/", controller.getNotifications);
notificationRouter.get("/stats", controller.getStats);
notificationRouter.get("/borrower-recent/:borrowerId", controller.getBorrowerRecentNotification);
notificationRouter.post("/send", controller.sendManualNotification);
notificationRouter.post("/trigger-sweep", controller.triggerScheduledSweep);
