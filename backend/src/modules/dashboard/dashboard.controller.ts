import type { NextFunction, Request, Response } from "express";

import { getOverallReturns, getPortfolioSummary, getScheduledSummary } from "./dashboard.service.js";

export async function getDashboardSummary(_req: Request, res: Response, next: NextFunction) {
    try {
        const [portfolio, returns, scheduled] = await Promise.all([
            getPortfolioSummary(),
            getOverallReturns(),
            getScheduledSummary(),
        ]);

        res.json({ portfolio, returns, scheduled });
    } catch (err) {
        next(err);
    }
}

export async function getDashboardPortfolio(_req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await getPortfolioSummary());
    } catch (err) {
        next(err);
    }
}
