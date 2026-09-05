import type { Request, Response } from "express";

import { BadRequestError } from "../../common/errors";
import * as identityDocumentService from "./identity-document.service";
import { isIdentityDocumentKind } from "./identity-document.service";

/** Rejects an unknown :kind before any storage or database work happens. */
function requireKind(req: Request): identityDocumentService.IdentityDocumentKind {
    const kind = String(req.params.kind);
    if (!isIdentityDocumentKind(kind)) {
        throw new BadRequestError(
            `Invalid document kind "${kind}". Must be one of: ${identityDocumentService.IDENTITY_DOCUMENT_KINDS.join(", ")}.`,
        );
    }
    return kind;
}

export async function uploadIdentityDocument(req: Request, res: Response): Promise<void> {
    const kind = requireKind(req);
    if (!req.file) throw new BadRequestError("No file was provided in the request.");

    const result = await identityDocumentService.upload(String(req.params.id), kind, {
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
    });

    res.status(201).json({ success: true, data: result });
}

export async function getIdentityDocumentSignedUrl(req: Request, res: Response): Promise<void> {
    const kind = requireKind(req);
    const expiresIn = req.query.expiresIn ? Number(req.query.expiresIn) : undefined;

    const result = await identityDocumentService.getSignedUrl(String(req.params.id), kind, expiresIn);
    res.status(200).json({ success: true, data: result });
}

export async function downloadIdentityDocument(req: Request, res: Response): Promise<void> {
    const kind = requireKind(req);
    const { buffer, fileName } = await identityDocumentService.download(String(req.params.id), kind);

    res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(/"/g, "")}"`);
    res.status(200).send(buffer);
}

export async function deleteIdentityDocument(req: Request, res: Response): Promise<void> {
    const kind = requireKind(req);
    await identityDocumentService.remove(String(req.params.id), kind);
    res.status(204).send();
}
