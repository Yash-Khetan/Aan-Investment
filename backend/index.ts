import "dotenv/config";
import cors from "cors";
import express from "express";

import { accountingExportRouter } from "./src/modules/accounting-export/index.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/accounting", accountingExportRouter);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: "NOT_FOUND",
            message: `Route not found: ${req.method} ${req.originalUrl}`,
        },
    });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
