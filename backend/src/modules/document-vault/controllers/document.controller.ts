import type { Request, Response } from "express";
import { DocumentService } from "../services/document.service";
import { mapErrorToHttpResponse } from "../utils/http-error-mapper";
import { MissingFileError } from "../utils/errors";
import { DEFAULT_SIGNED_URL_EXPIRY_SECONDS } from "../constants/document.constants";

export async function uploadDocument(req: Request, res: Response): Promise<void> {
    try {
        if (!req.file) {
            throw new MissingFileError("No file was provided in the request.");
        }

        const { entityType, entityId, documentType, name, remarks, uploadedBy } = req.body;

        const metadata = await DocumentService.upload({
            entityType,
            entityId,
            documentType,
            name,
            remarks,
            uploadedBy,
            file: {
                buffer: req.file.buffer,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
            },
        });

        res.status(201).json(metadata);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function downloadDocument(req: Request, res: Response): Promise<void> {
    try {
        const { buffer, metadata } = await DocumentService.download(String(req.params.id));

        res.setHeader("Content-Type", metadata.mimeType ?? "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(metadata.name)}"`);
        res.send(buffer);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function deleteDocument(req: Request, res: Response): Promise<void> {
    try {
        await DocumentService.delete(String(req.params.id));
        res.status(204).send();
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function listDocuments(req: Request, res: Response): Promise<void> {
    try {
        const { entityType, entityId } = req.params;
        const metadata = await DocumentService.list(String(entityType), String(entityId));
        res.status(200).json(metadata);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function getSignedUrl(req: Request, res: Response): Promise<void> {
    try {
        const expiresInSeconds = req.query.expiresIn ? Number(req.query.expiresIn) : DEFAULT_SIGNED_URL_EXPIRY_SECONDS;

        const result = await DocumentService.generateSignedUrl(String(req.params.id), expiresInSeconds);
        res.status(200).json(result);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}
