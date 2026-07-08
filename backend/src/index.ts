import "dotenv/config";
import express from "express";
import { documentRouter } from "./modules/document-vault";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

app.use("/documents", documentRouter);

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
