import { Router } from "express";
import { uploadSingleFile } from "../middleware/upload.middleware";
import { authenticate } from "../../auth/auth.middleware";
import {
    uploadDocument,
    downloadDocument,
    deleteDocument,
    listDocuments,
    searchDocuments,
    getSignedUrl,
} from "../controllers/document.controller";

const documentRouter = Router();

documentRouter.use(authenticate);

documentRouter.get("/", searchDocuments);
documentRouter.post("/upload", uploadSingleFile, uploadDocument);
documentRouter.get("/entity/:entityType/:entityId", listDocuments);
documentRouter.get("/:id/signed-url", getSignedUrl);
documentRouter.get("/:id", downloadDocument);
documentRouter.delete("/:id", deleteDocument);

export { documentRouter };
