import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../../db";
import { documents } from "../../../db/schema";
import {
    assertValidEntityType,
    assertValidEntityId,
    assertValidDocumentType,
    assertFilePresent,
    assertValidMimeType,
    assertValidFileSize,
} from "../validators/document.validators";
import { generateStorageFileName, buildStoragePath } from "../utils/filename.util";
import { uploadObject, downloadObject, removeObject, createSignedUrl } from "../utils/storage.util";
import { documentLogger } from "../utils/logger";
import { DocumentNotFoundError, DocumentPersistenceError } from "../utils/errors";
import { DEFAULT_DOCUMENT_TYPE, DEFAULT_SIGNED_URL_EXPIRY_SECONDS } from "../constants/document.constants";
import type {
    UploadDocumentInput,
    DocumentMetadata,
    DownloadResult,
    SignedUrlResult,
    EntityType,
} from "../types/document.types";

type DocumentRow = typeof documents.$inferSelect;

function toDocumentMetadata(row: DocumentRow): DocumentMetadata {
    return {
        id: row.id,
        entityType: row.ownerType as EntityType,
        entityId: row.ownerId,
        documentType: row.documentType,
        name: row.name,
        fileName: row.fileName,
        storagePath: row.storagePath,
        mimeType: row.mimeType,
        sizeBytes: row.fileSizeBytes,
        isVerified: row.isVerified,
        verifiedBy: row.verifiedBy,
        uploadedBy: row.uploadedBy,
        remarks: row.remarks,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/**
 * Generic document storage service. Consuming modules (loans, borrowers,
 * collaterals, collections, ...) should only ever go through this class —
 * never touch Supabase Storage or the `documents` table directly — so the
 * storage implementation can change without touching call sites.
 */
export class DocumentService {
    static async upload(input: UploadDocumentInput): Promise<DocumentMetadata> {
        const { entityType, entityId, file } = input;

        assertValidEntityType(entityType);
        assertValidEntityId(entityId);
        assertFilePresent(file);
        assertValidMimeType(file.mimeType);
        assertValidFileSize(file.size);

        const documentType = input.documentType ?? DEFAULT_DOCUMENT_TYPE;
        assertValidDocumentType(documentType);

        const storageFileName = generateStorageFileName(file.originalName);
        const storagePath = buildStoragePath(entityType, entityId, storageFileName);
        const context = `${entityType}/${entityId}`;

        await uploadObject(storagePath, file.buffer, file.mimeType);

        try {
            const [row] = await db
                .insert(documents)
                .values({
                    ownerType: entityType,
                    ownerId: entityId,
                    documentType,
                    name: input.name ?? file.originalName,
                    fileName: storageFileName,
                    storagePath,
                    mimeType: file.mimeType,
                    fileSizeBytes: file.size,
                    uploadedBy: input.uploadedBy,
                    remarks: input.remarks,
                })
                .returning();

            documentLogger.success("UPLOAD", row.id);
            return toDocumentMetadata(row);
        } catch (error) {
            // Storage upload already succeeded — remove the orphaned object so storage and the db stay consistent.
            await removeObject(storagePath).catch(() => undefined);
            documentLogger.failure("UPLOAD", context, error);
            throw new DocumentPersistenceError(
                `Failed to save document metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
                error
            );
        }
    }

    static async download(id: string): Promise<DownloadResult> {
        const row = await this.getActiveRowOrThrow(id);

        try {
            const buffer = await downloadObject(row.storagePath!);
            documentLogger.success("DOWNLOAD", id);
            return { buffer, metadata: toDocumentMetadata(row) };
        } catch (error) {
            documentLogger.failure("DOWNLOAD", id, error);
            throw error;
        }
    }

    static async delete(id: string): Promise<void> {
        const row = await this.getActiveRowOrThrow(id);

        await db.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, id));

        try {
            await removeObject(row.storagePath!);
            documentLogger.success("DELETE", id);
        } catch (error) {
            // The document is already gone from the database at this point; a storage object left
            // behind is an orphan to clean up out-of-band, not a reason to fail the delete request.
            documentLogger.failure("DELETE", id, error);
        }
    }

    static async list(entityType: string, entityId: string): Promise<DocumentMetadata[]> {
        assertValidEntityType(entityType);
        assertValidEntityId(entityId);

        const rows = await db
            .select()
            .from(documents)
            .where(and(eq(documents.ownerType, entityType), eq(documents.ownerId, entityId), isNull(documents.deletedAt)));

        documentLogger.success("LIST", `${entityType}/${entityId}`);
        return rows.map(toDocumentMetadata);
    }

    static async generateSignedUrl(
        id: string,
        expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRY_SECONDS
    ): Promise<SignedUrlResult> {
        const row = await this.getActiveRowOrThrow(id);

        try {
            const url = await createSignedUrl(row.storagePath!, expiresInSeconds);
            documentLogger.success("SIGNED_URL", id);
            return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
        } catch (error) {
            documentLogger.failure("SIGNED_URL", id, error);
            throw error;
        }
    }

    private static async getActiveRowOrThrow(id: string): Promise<DocumentRow> {
        const [row] = await db
            .select()
            .from(documents)
            .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
            .limit(1);

        if (!row) {
            throw new DocumentNotFoundError(`No document found with id "${id}".`);
        }

        return row;
    }
}
