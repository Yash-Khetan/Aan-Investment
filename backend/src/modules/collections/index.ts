/**
 * Public surface of the collections module. Other parts of the application
 * (loans, accounting, ...) should import only from this file, never from
 * internal folders directly.
 *
 * Running this file directly also starts a local server with every
 * endpoint below mounted against the real database, seeded with one
 * throwaway test loan — for manual testing (Postman, curl) before an
 * app-wide entry point exists.
 *
 *   npx tsx src/modules/collections/index.ts
 */

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import express from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { borrowers, loans, collectionCases } from "../../db/schema";
import { collectionsRouter } from "./routes/collections.routes";

export { collectionsRouter } from "./routes/collections.routes";
export { CollectionsService } from "./services/collections.service";

export type {
    ActivityType,
    CollectionStatus,
    CreateActivityInput,
    UpdateActivityInput,
    UpdateStatusInput,
    UpdateFollowUpInput,
    CreatePromiseToPayInput,
    ClosePromiseToPayInput,
    CollectionActivityRecord,
} from "./types/collections.types";

export {
    CollectionsError,
    CollectionActivityNotFoundError,
    LoanNotFoundError,
    CustomerNotFoundError,
    ValidationError,
    InvalidActivityTypeError,
    InvalidStatusError,
    InvalidPromiseToPayStateError,
    CollectionsPersistenceError,
} from "./utils/errors";

export { ACTIVITY_TYPES } from "./constants/collections.constants";
export { isOpenStatus, isClosedStatus, isPromiseToPayStatus } from "./utils/status.util";
export { formatDate, isPastDate, isValidDateString } from "./utils/date.util";

/* ============================================================
   Endpoint reference — also printed to the console by the dev
   server below, so this list is the single source of truth for
   what this module exposes.
============================================================ */

const ENDPOINTS: ReadonlyArray<{ method: string; path: string; description: string }> = [
    { method: "POST", path: "/collections", description: "Create a collection activity" },
    { method: "GET", path: "/collections/loan/:loanId", description: "List all activities for a loan" },
    { method: "GET", path: "/collections/customer/:customerId", description: "List all activities for a customer" },
    { method: "PATCH", path: "/collections/:id/status", description: "Update the collection status" },
    { method: "PATCH", path: "/collections/:id/follow-up", description: "Update the next follow-up date" },
    { method: "POST", path: "/collections/:id/promise-to-pay", description: "Record a Promise to Pay" },
    { method: "PATCH", path: "/collections/:id/promise-to-pay/close", description: "Close a Promise to Pay" },
    { method: "GET", path: "/collections/:id", description: "Get an activity by id" },
    { method: "PUT", path: "/collections/:id", description: "Update an activity" },
    { method: "DELETE", path: "/collections/:id", description: "Soft-delete an activity" },
];

/* ============================================================
   Dev server — only runs when this file is executed directly,
   never when another module imports from it.
============================================================ */

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const TEST_MARKER = "__TEST_COLLECTIONS_MODULE__";

async function seedTestLoan(): Promise<{ loanId: string; borrowerId: string }> {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const [borrower] = await db
        .insert(borrowers)
        .values({
            borrowerCode: `${TEST_MARKER}_${suffix}`,
            name: "Test Borrower (collections module)",
            constitution: "INDIVIDUAL",
            notes: TEST_MARKER,
        })
        .returning();

    const [loan] = await db
        .insert(loans)
        .values({
            loanAccountNumber: `${TEST_MARKER}_${suffix}`,
            borrowerId: borrower.id,
            loanType: "SECURED",
            repaymentType: "EMI",
            sanctionedAmount: "1000000.00",
            outstandingPrincipal: "750000.00",
            interestRate: "12.5",
            tenureMonths: 60,
            remarks: TEST_MARKER,
        })
        .returning();

    return { loanId: loan.id, borrowerId: borrower.id };
}

async function removeTestLoan(loanId: string, borrowerId: string): Promise<void> {
    // collection_cases.loan_id / borrower_id have no ON DELETE CASCADE, so any
    // case created via the API during testing must be removed before the loan
    // and borrower themselves — otherwise the deletes below fail with a
    // foreign-key violation. Removing the case cascades to its follow_ups
    // (that relation does have ON DELETE CASCADE).
    await db.delete(collectionCases).where(eq(collectionCases.loanId, loanId));
    await db.delete(loans).where(eq(loans.id, loanId));
    await db.delete(borrowers).where(eq(borrowers.id, borrowerId));
}

async function startDevServer(): Promise<void> {
    const seeded = await seedTestLoan();

    const app = express();
    app.use(express.json());
    app.use("/collections", collectionsRouter);

    const server = app.listen(PORT, () => {
        console.log(`\nCollections module dev server listening on http://localhost:${PORT}`);

        console.log(`\nEndpoints:`);
        for (const { method, path, description } of ENDPOINTS) {
            console.log(`  ${method.padEnd(6)} ${path.padEnd(42)} ${description}`);
        }

        console.log(`\nSeeded test loan:`);
        console.log(`  loanId: ${seeded.loanId}`);
        console.log(`  borrowerId (customerId): ${seeded.borrowerId}`);

        console.log(`\nExample — POST http://localhost:${PORT}/collections`);
        console.log(
            JSON.stringify(
                {
                    loanId: seeded.loanId,
                    activityType: "CALL",
                    followUpDate: "2026-07-15",
                    contactPerson: "Rahul Sharma",
                    remarks: "Customer called; promised to pay by month end.",
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
        console.error("Failed to start collections dev server:", error);
        process.exit(1);
    });
}
