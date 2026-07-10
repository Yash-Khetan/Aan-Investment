import type { NextFunction, Request, Response } from "express";

import { getCollectionsSummary, getPortfolioSummary } from "./dashboard.service.js";

export async function getDashboardSummary(req: Request, res: Response, next: NextFunction) {
    try {
        const [portfolio, collections] = await Promise.all([
            getPortfolioSummary(),
            getCollectionsSummary(),
        ]);

        res.json({ portfolio, collections });
    } catch (err) {
        next(err);
    }
}

export async function getDashboardPortfolio(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await getPortfolioSummary());
    } catch (err) {
        next(err);
    }
}

export async function getDashboardCollections(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await getCollectionsSummary());
    } catch (err) {
        next(err);
    }
}
