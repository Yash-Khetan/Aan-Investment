import "dotenv/config";
import cors from "cors";
import express from "express";

import { accountingExportRouter } from "./modules/accounting-export";
import { collateralRouter } from "./modules/collateral";
import { collectionsRouter } from "./modules/collections";
import { documentRouter } from "./modules/document-vault";
import { reportsRouter } from "./modules/reports";
import dashboardRouter from "./modules/dashboard/routes/dashboard.routes.js";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

app.use("/documents", documentRouter);
app.use("/collateral", collateralRouter);
app.use("/collections", collectionsRouter);
app.use("/reports", reportsRouter);
app.use("/accounting", accountingExportRouter);
app.use("/dashboard", dashboardRouter);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: "NOT_FOUND",
            message: `Route not found: ${req.method} ${req.originalUrl}`,
        },
    });
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
