import { Router } from "express";
import { eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { borrowers, loans } from "../db/schema/index.js";
import { authenticate } from "../modules/auth/auth.middleware";

/**
 * Minimal, read-only lookup endpoints for the frontend. None of the six
 * feature modules expose a loan/borrower id alongside a human-readable
 * label (loan-register only returns loanAccountNumber, never the id) —
 * but collateral, collections, and document-vault all require a real
 * loanId/borrowerId UUID as input. Without this, there is no way for a
 * UI to look up which UUID a given loan/borrower actually is.
 *
 * Intentionally not a full module (controllers/services/etc.) — it's two
 * trivial SELECT queries, not a domain with business logic of its own.
 */
export const lookupRouter = Router();

lookupRouter.use(authenticate);

lookupRouter.get("/loans", async (_req, res, next) => {
    try {
        const rows = await db
            .select({
                id: loans.id,
                loanAccountNumber: loans.loanAccountNumber,
                customerName: borrowers.name,
                status: loans.status,
                outstandingPrincipal: loans.outstandingPrincipal,
            })
            .from(loans)
            .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
            .orderBy(loans.loanAccountNumber);

        res.status(200).json(rows);
    } catch (error) {
        next(error);
    }
});

lookupRouter.get("/borrowers", async (_req, res, next) => {
    try {
        const rows = await db
            .select({
                id: borrowers.id,
                borrowerCode: borrowers.borrowerCode,
                name: borrowers.name,
            })
            .from(borrowers)
            .orderBy(borrowers.name);

        res.status(200).json(rows);
    } catch (error) {
        next(error);
    }
});
