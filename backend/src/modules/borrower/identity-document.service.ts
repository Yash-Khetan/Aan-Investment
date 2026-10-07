import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "../../db";
import { borrowers, documents } from "../../db/schema";
import { NotFoundError, ValidationError } from "../../common/errors";
import {
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE_BYTES,
    buildObjectPath,
    createSignedUrl,
    downloadObject,
    removeObject,
    uploadObject,
} from "./identity-document.storage";

/**
 * The identity numbers a borrower can attach a scan to. These are URL
 * segments; each maps onto a document-vault `document_type`.
 *
 * A scan is an ordinary row in the `documents` table, owned by the borrower —
 * the one place every document lives — so it appears in the Documents tab,
 * the borrower's document list and the Document report like any other file.
 * The borrower's current scan of a kind is its latest live row of that type.
 */
export const IDENTITY_DOCUMENT_KINDS = ["pan", "aadhaar", "ckyc"] as const;
export type IdentityDocumentKind = (typeof IDENTITY_DOCUMENT_KINDS)[number];

const DOCUMENT_TYPE = {
    pan: "PAN_CARD",
    aadhaar: "AADHAAR",
    ckyc: "KYC",
} as const satisfies Record<IdentityDocumentKind, string>;

const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 300;

export function isIdentityDocumentKind(value: string): value is IdentityDocumentKind {
    return (IDENTITY_DOCUMENT_KINDS as readonly string[]).includes(value);
}

export interface IdentityDocumentFile {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    size: number;
}

export interface IdentityDocumentRef {
    kind: IdentityDocumentKind;
    path: string;
    name: string | null;
}

/** The pointer fields a borrower read carries for its three identity scans. */
export interface IdentityDocumentFields {
    panDocPath: string | null;
    panDocName: string | null;
    aadhaarDocPath: string | null;
    aadhaarDocName: string | null;
    ckycDocPath: string | null;
    ckycDocName: string | null;
}

const EMPTY_FIELDS: IdentityDocumentFields = {
    panDocPath: null,
    panDocName: null,
    aadhaarDocPath: null,
    aadhaarDocName: null,
    ckycDocPath: null,
    ckycDocName: null,
};

/**
 * Each borrower's current identity scans, keyed by borrower id, in the shape
 * borrower reads have always carried. Every requested borrower is present.
 */
export async function getIdentityDocumentFields(
    borrowerIds: string[],
): Promise<Map<string, IdentityDocumentFields>> {
    const result = new Map<string, IdentityDocumentFields>(borrowerIds.map((id) => [id, { ...EMPTY_FIELDS }]));
    if (borrowerIds.length === 0) return result;

    const rows = await db
        .select({
            ownerId: documents.ownerId,
            documentType: documents.documentType,
            storagePath: documents.storagePath,
            fileName: documents.fileName,
        })
        .from(documents)
        .where(
            and(
                eq(documents.ownerType, "BORROWER"),
                inArray(documents.ownerId, borrowerIds),
                inArray(documents.documentType, Object.values(DOCUMENT_TYPE)),
                isNull(documents.deletedAt),
            ),
        )
        .orderBy(desc(documents.createdAt));

    const seen = new Set<string>();
    for (const row of rows) {
        const key = `${row.ownerId}:${row.documentType}`;
        if (seen.has(key)) continue; // newest first — the first one seen is current
        seen.add(key);

        const fields = result.get(row.ownerId)!;
        const kind = IDENTITY_DOCUMENT_KINDS.find((k) => DOCUMENT_TYPE[k] === row.documentType)!;
        fields[`${kind}DocPath`] = row.storagePath;
        fields[`${kind}DocName`] = row.fileName;
    }

    return result;
}

async function assertBorrowerExists(borrowerId: string): Promise<void> {
    const [row] = await db
        .select({ id: borrowers.id })
        .from(borrowers)
        .where(and(eq(borrowers.id, borrowerId), isNull(borrowers.deletedAt)))
        .limit(1);

    if (!row) throw new NotFoundError(`Borrower ${borrowerId} was not found.`);
}

/** The borrower's current scan of a kind, or null when none is attached. */
async function getCurrent(borrowerId: string, kind: IdentityDocumentKind) {
    await assertBorrowerExists(borrowerId);

    const [row] = await db
        .select({ id: documents.id, path: documents.storagePath, name: documents.fileName })
        .from(documents)
        .where(
            and(
                eq(documents.ownerType, "BORROWER"),
                eq(documents.ownerId, borrowerId),
                eq(documents.documentType, DOCUMENT_TYPE[kind]),
                isNull(documents.deletedAt),
            ),
        )
        .orderBy(desc(documents.createdAt))
        .limit(1);

    return row ?? null;
}

/**
 * Stores a scan as the borrower's current document of this kind. Replacing an
 * existing scan retires the old row and deletes its object afterwards — only
 * once the new row is in place, so a failure mid-way can never leave the
 * borrower pointing at bytes that are already gone.
 */
export const upload = async (
    borrowerId: string,
    kind: IdentityDocumentKind,
    file: IdentityDocumentFile,
    uploadedBy?: string,
): Promise<IdentityDocumentRef> => {
    if (!file?.buffer?.length) throw new ValidationError("No file was provided.");

    if (!ALLOWED_MIME_TYPES.includes(file.mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
        throw new ValidationError(
            `Unsupported file type "${file.mimeType}". Allowed: ${ALLOWED_MIME_TYPES.join(", ")}.`,
        );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new ValidationError(`File exceeds the maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`);
    }

    const previous = await getCurrent(borrowerId, kind);
    const objectPath = buildObjectPath(borrowerId, file.originalName);

    await uploadObject(objectPath, file.buffer, file.mimeType);

    try {
        await db.transaction(async (tx) => {
            if (previous) {
                await tx.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, previous.id));
            }
            await tx.insert(documents).values({
                ownerType: "BORROWER",
                ownerId: borrowerId,
                documentType: DOCUMENT_TYPE[kind],
                name: file.originalName,
                fileName: file.originalName,
                storagePath: objectPath,
                mimeType: file.mimeType,
                fileSizeBytes: file.size,
                uploadedBy,
                remarks: `${kind.toUpperCase()} scan`,
            });
        });
    } catch (error) {
        // Nothing points at the object just written, so remove it rather than leave it unreferenced.
        await removeObject(objectPath).catch(() => undefined);
        throw error;
    }

    if (previous?.path && previous.path !== objectPath) {
        await removeObject(previous.path).catch(() => undefined);
    }

    return { kind, path: objectPath, name: file.originalName };
};

export const getSignedUrl = async (
    borrowerId: string,
    kind: IdentityDocumentKind,
    expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
): Promise<{ url: string; expiresAt: Date }> => {
    const current = await getCurrent(borrowerId, kind);
    if (!current?.path) throw new NotFoundError(`This borrower has no ${kind} document.`);

    const url = await createSignedUrl(current.path, expiresInSeconds);
    return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
};

export const download = async (
    borrowerId: string,
    kind: IdentityDocumentKind,
): Promise<{ buffer: Buffer; fileName: string }> => {
    const current = await getCurrent(borrowerId, kind);
    if (!current?.path) throw new NotFoundError(`This borrower has no ${kind} document.`);

    return { buffer: await downloadObject(current.path), fileName: current.name ?? `${kind}-document` };
};

/** Retires the row first, then removes the object - so a storage failure cannot strand the row. */
export const remove = async (borrowerId: string, kind: IdentityDocumentKind): Promise<void> => {
    const current = await getCurrent(borrowerId, kind);
    if (!current) return;

    await db.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, current.id));

    if (current.path) await removeObject(current.path).catch(() => undefined);
};
