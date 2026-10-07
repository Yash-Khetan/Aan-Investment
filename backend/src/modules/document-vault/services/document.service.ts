import { and, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../../db";
import { borrowers, documents, loans } from "../../../db/schema";
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
    DocumentSearchInput,
    DocumentSearchResult,
    DocumentClassification,
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
            if (!row) throw new Error("The database returned no row for this write.");

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

    /**
     * Every live document of every borrower and loan, newest first, each
     * labelled with the borrower (and loan) it belongs to — the Documents
     * tab's "All documents" view. Filtering by borrower returns the
     * borrower's own documents and those of every loan they hold.
     */
    static async search(input: DocumentSearchInput): Promise<DocumentSearchResult> {
        if (input.borrowerId) assertValidEntityId(input.borrowerId);
        if (input.loanId) assertValidEntityId(input.loanId);
        const documentType = input.documentType;
        if (documentType) assertValidDocumentType(documentType);

        const conditions: SQL[] = [
            isNull(documents.deletedAt),
            isNull(borrowers.deletedAt),
            // Only documents of a borrower or loan that still exists resolve a borrower.
            sql`${borrowers.id} is not null`,
        ];
        if (input.borrowerId) conditions.push(eq(borrowers.id, input.borrowerId));
        if (input.loanId) conditions.push(and(eq(documents.ownerType, "LOAN"), eq(documents.ownerId, input.loanId))!);
        // Validated above.
        if (documentType) conditions.push(eq(documents.documentType, documentType as DocumentClassification));
        if (input.search) {
            const term = `%${input.search}%`;
            conditions.push(
                or(
                    ilike(documents.name, term),
                    ilike(documents.fileName, term),
                    ilike(borrowers.name, term),
                    ilike(loans.loanAccountNumber, term),
                )!,
            );
        }

        const where = and(...conditions);
        const loanJoin = and(eq(documents.ownerType, "LOAN"), eq(loans.id, documents.ownerId), isNull(loans.deletedAt));
        const borrowerJoin = or(
            and(eq(documents.ownerType, "BORROWER"), eq(borrowers.id, documents.ownerId)),
            eq(borrowers.id, loans.borrowerId),
        );

        const rows = await db
            .select({
                document: documents,
                borrowerId: borrowers.id,
                borrowerName: borrowers.name,
                loanId: loans.id,
                loanAccountNumber: loans.loanAccountNumber,
            })
            .from(documents)
            .leftJoin(loans, loanJoin)
            .leftJoin(borrowers, borrowerJoin)
            .where(where)
            .orderBy(desc(documents.createdAt))
            .limit(input.limit)
            .offset((input.page - 1) * input.limit);

        const [countRow] = await db
            .select({ total: sql<number>`count(*)::int` })
            .from(documents)
            .leftJoin(loans, loanJoin)
            .leftJoin(borrowers, borrowerJoin)
            .where(where);

        return {
            rows: rows.map((r) => ({
                ...toDocumentMetadata(r.document),
                borrowerId: r.borrowerId,
                borrowerName: r.borrowerName,
                loanId: r.loanId,
                loanAccountNumber: r.loanAccountNumber,
            })),
            total: countRow?.total ?? 0,
            page: input.page,
            limit: input.limit,
        };
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
