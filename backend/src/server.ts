import "dotenv/config";

import { app } from "./app.js";
import { clearDashboardData, seedDashboardData, type DashboardSeedIds } from "./db/seed/dashboardSeed.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function main() {
    const seedIds: DashboardSeedIds = await seedDashboardData();
    console.log(
        `Seeded dashboard test data: ${seedIds.borrowerIds.length} borrowers, ${seedIds.loanIds.length} loans, ${seedIds.collectionCaseIds.length} collection cases`,
    );

    const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

    let shuttingDown = false;

    async function shutdown() {
        if (shuttingDown) return;
        shuttingDown = true;

        console.log("Shutting down, removing seeded dashboard data...");
        try {
            await clearDashboardData(seedIds);
            console.log("Seeded dashboard data removed.");
        } catch (err) {
            console.error("Failed to remove seeded dashboard data:", err);
        }

        server.close(() => process.exit(0));
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

main().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
