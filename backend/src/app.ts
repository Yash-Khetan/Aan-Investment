import cors from "cors";
import express, { type Application } from "express";

import { errorHandler } from "./common/middleware/errorHandler";
import { notFoundHandler } from "./common/middleware/notFound";
import apiRouter from "./routes/index";

/**
 * Builds and configures the Express application. Kept separate from the HTTP
 * listener (server.ts) so it can be imported by tests without binding a port.
 */
export const createApp = (): Application => {
    const app = express();

    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.get("/health", (_req, res) => {
        res.json({ success: true, data: { status: "ok" } });
    });

    app.use("/api/v1", apiRouter);

    // 404 for unmatched routes, then the centralized error handler (last).
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
};
