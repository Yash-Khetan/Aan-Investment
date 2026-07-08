/**
 * Public surface of the collateral module. Other parts of the application
 * (loans, collections, ...) should import only from this file, never from
 * internal folders directly.
 *
 * Running this file directly also starts a local server with every
 * endpoint below mounted against the real database, seeded with one
 * throwaway test loan — for manual testing (Postman, curl) before an
 * app-wide entry point exists.
 *
 *   npx tsx src/modules/collateral/index.ts
 */

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import express from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { borrowers, loans } from "../../db/schema";
import { collateralRouter } from "./routes/collateral.routes";

export { collateralRouter } from "./routes/collateral.routes";
export { CollateralService } from "./services/collateral.service";

export type {
    CollateralType,
    CollateralStatus,
    CreateCollateralInput,
    UpdateCollateralInput,
    UpdateValuationInput,
    UpdateInsuranceInput,
    CollateralRecord,
    InsuranceRecord,
    LtvResult,
} from "./types/collateral.types";

export {
    CollateralError,
    CollateralNotFoundError,
    LoanNotFoundError,
    InvalidCollateralTypeError,
    ValidationError,
    DuplicateCollateralError,
    LtvCalculationError,
    CollateralPersistenceError,
} from "./utils/errors";

export { calculateLtv } from "./utils/ltv.util";
export { getInsuranceHealth, isActiveStatus, isInactiveStatus } from "./utils/status.util";
export { formatDate, isPastDate, isValidDateString } from "./utils/date.util";

/* ============================================================
   Endpoint reference — also printed to the console by the dev
   server below, so this list is the single source of truth for
   what this module exposes.
============================================================ */

const ENDPOINTS: ReadonlyArray<{ method: string; path: string; description: string }> = [
    { method: "POST", path: "/collateral", description: "Create a collateral" },
    { method: "GET", path: "/collateral/loan/:loanId", description: "List all collateral for a loan" },
    { method: "GET", path: "/collateral/:id/ltv", description: "Recalculate and return LTV for a collateral" },
    { method: "PATCH", path: "/collateral/:id/valuation", description: "Update valuation (recomputes LTV)" },
    { method: "PATCH", path: "/collateral/:id/insurance", description: "Create/update insurance details" },
    { method: "GET", path: "/collateral/:id", description: "Get a collateral by id" },
    { method: "PUT", path: "/collateral/:id", description: "Update a collateral" },
    { method: "DELETE", path: "/collateral/:id", description: "Soft-delete a collateral" },
];

/* ============================================================
   Dev server — only runs when this file is executed directly,
   never when another module imports from it.
============================================================ */

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const TEST_MARKER = "__TEST_COLLATERAL_MODULE__";

async function seedTestLoan(): Promise<{ loanId: string; borrowerId: string; outstandingPrincipal: string }> {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const [borrower] = await db
        .insert(borrowers)
        .values({
            borrowerCode: `${TEST_MARKER}_${suffix}`,
            name: "Test Borrower (collateral module)",
            constitution: "INDIVIDUAL",
            notes: TEST_MARKER,
        })
        .returning();

    const outstandingPrincipal = "750000.00";

    const [loan] = await db
        .insert(loans)
        .values({
            loanAccountNumber: `${TEST_MARKER}_${suffix}`,
            borrowerId: borrower.id,
            loanType: "SECURED",
            repaymentType: "EMI",
            sanctionedAmount: "1000000.00",
            outstandingPrincipal,
            interestRate: "12.5",
            tenureMonths: 60,
            remarks: TEST_MARKER,
        })
        .returning();

    return { loanId: loan.id, borrowerId: borrower.id, outstandingPrincipal };
}

async function removeTestLoan(loanId: string, borrowerId: string): Promise<void> {
    // Deleting the loan cascades to any collateral/insurance created against it.
    await db.delete(loans).where(eq(loans.id, loanId));
    await db.delete(borrowers).where(eq(borrowers.id, borrowerId));
}

async function startDevServer(): Promise<void> {
    const seeded = await seedTestLoan();

    const app = express();
    app.use(express.json());
    app.use("/collateral", collateralRouter);

    const server = app.listen(PORT, () => {
        console.log(`\nCollateral module dev server listening on http://localhost:${PORT}`);

        console.log(`\nEndpoints:`);
        for (const { method, path, description } of ENDPOINTS) {
            console.log(`  ${method.padEnd(6)} ${path.padEnd(32)} ${description}`);
        }

        console.log(`\nSeeded test loan (outstandingPrincipal = ${seeded.outstandingPrincipal}):`);
        console.log(`  loanId: ${seeded.loanId}`);

        console.log(`\nExample — POST http://localhost:${PORT}/collateral`);
        console.log(
            JSON.stringify(
                {
                    loanId: seeded.loanId,
                    securityType: "PROPERTY",
                    estimatedValue: 500000,
                    surveyNumber: "SVY-001",
                    valuationDate: "2026-01-01",
                },
                null,
                2
            )
        );

        console.log(`\nPress Ctrl+C to stop and clean up the seeded test loan.\n`);
    });

    let shuttingDown = false;
    const shutdown = async () => {
        if (shuttingDown) return;
        shuttingDown = true;

        console.log("\nShutting down — cleaning up seeded test loan...");
        server.close();
        await removeTestLoan(seeded.loanId, seeded.borrowerId);
        console.log("Done. Test loan removed.");
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

const isMainModule =
    process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
    startDevServer().catch((error) => {
        console.error("Failed to start collateral dev server:", error);
        process.exit(1);
    });
}
