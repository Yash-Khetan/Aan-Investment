import { Router } from "express";

import { asyncHandler } from "../../common/http/asyncHandler";
import { validate } from "../../common/middleware/validate";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import * as borrowerController from "./borrower.controller";
import * as identityDocumentController from "./identity-document.controller";
import { uploadIdentityFile } from "./identity-document.middleware";
import {
    borrowerIdParamSchema,
    createBorrowerSchema,
    listBorrowersQuerySchema,
    updateBorrowerSchema,
} from "./borrower.validators";

const router = Router();

router.post(
    "/",
    authenticate,
    validate({ body: createBorrowerSchema }),
    asyncHandler(borrowerController.createBorrower),
);

router.get(
    "/",
    authenticate,
    validate({ query: listBorrowersQuerySchema }),
    asyncHandler(borrowerController.listBorrowers),
);

router.get(
    "/:id",
    authenticate,
    validate({ params: borrowerIdParamSchema }),
    asyncHandler(borrowerController.getBorrowerById),
);

router.put(
    "/:id",
    authenticate,
    authorize("borrower:update"),
    validate({ params: borrowerIdParamSchema, body: updateBorrowerSchema }),
    asyncHandler(borrowerController.updateBorrower),
);

/* ── Identity document scans ──

   :kind is pan | aadhaar | ckyc. Each borrower holds at most one scan per kind,
   stored as a pointer on the borrowers row - uploading again replaces it. These
   never become rows in the document-vault module's `documents` table. */

router.post(
    "/:id/identity-documents/:kind",
    authenticate,
    validate({ params: borrowerIdParamSchema }),
    uploadIdentityFile,
    asyncHandler(identityDocumentController.uploadIdentityDocument),
);

router.get(
    "/:id/identity-documents/:kind/signed-url",
    authenticate,
    validate({ params: borrowerIdParamSchema }),
    asyncHandler(identityDocumentController.getIdentityDocumentSignedUrl),
);

router.get(
    "/:id/identity-documents/:kind",
    authenticate,
    validate({ params: borrowerIdParamSchema }),
    asyncHandler(identityDocumentController.downloadIdentityDocument),
);

router.delete(
    "/:id/identity-documents/:kind",
    authenticate,
    validate({ params: borrowerIdParamSchema }),
    asyncHandler(identityDocumentController.deleteIdentityDocument),
);

router.delete(
    "/:id",
    authenticate,
    validate({ params: borrowerIdParamSchema }),
    asyncHandler(borrowerController.deleteBorrower),
);

export default router;
