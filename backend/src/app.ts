import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";

import routes from "./routes/index.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", routes);

app.use((req: Request, res: Response) => {
    res.status(404).json({ error: "Not Found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    const status = err instanceof Error && "status" in err ? Number((err as { status: unknown }).status) : 500;
    const message = err instanceof Error ? err.message : "Internal Server Error";
    res.status(Number.isInteger(status) ? status : 500).json({ error: message });
});
