import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../db";
import { borrowers } from "../../db/schema";
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
 * The identity numbers a borrower can attach a scan to. These are URL segments,
 * deliberately lowercase and distinct from the document-vault `document_type`
 * enum - this module does not use that enum or its table.
 */
export const IDENTITY_DOCUMENT_KINDS = ["pan", "aadhaar", "ckyc"] as const;
export type IdentityDocumentKind = (typeof IDENTITY_DOCUMENT_KINDS)[number];

/** Which pair of `borrowers` columns backs each kind. */
const COLUMNS = {
    pan: { path: borrowers.panDocPath, name: borrowers.panDocName, pathKey: "panDocPath", nameKey: "panDocName" },
    aadhaar: {
        path: borrowers.aadhaarDocPath,
        name: borrowers.aadhaarDocName,
        pathKey: "aadhaarDocPath",
        nameKey: "aadhaarDocName",
    },
    ckyc: { path: borrowers.ckycDocPath, name: borrowers.ckycDocName, pathKey: "ckycDocPath", nameKey: "ckycDocName" },
} as const satisfies Record<IdentityDocumentKind, unknown>;

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

async function getCurrent(borrowerId: string, kind: IdentityDocumentKind) {
    const cols = COLUMNS[kind];

    const [row] = await db
        .select({ path: cols.path, name: cols.name })
        .from(borrowers)
        .where(and(eq(borrowers.id, borrowerId), isNull(borrowers.deletedAt)))
        .limit(1);

    if (!row) throw new NotFoundError(`Borrower ${borrowerId} was not found.`);
    return row;
}

/**
 * Stores a scan and points the borrower's column at it. Replacing an existing
 * scan deletes the old object afterwards, so a borrower never accumulates
 * orphaned files - but only once the column has been repointed, so a failure
 * mid-way can never leave the row pointing at bytes that are already gone.
 */
export const upload = async (
    borrowerId: string,
    kind: IdentityDocumentKind,
    file: IdentityDocumentFile,
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
    const cols = COLUMNS[kind];
    const objectPath = buildObjectPath(borrowerId, file.originalName);

    await uploadObject(objectPath, file.buffer, file.mimeType);

    try {
        await db
            .update(borrowers)
            .set({ [cols.pathKey]: objectPath, [cols.nameKey]: file.originalName })
            .where(eq(borrowers.id, borrowerId));
    } catch (error) {
        // The column still points at the old object (or nothing), so remove the
        // one just written rather than leaving it unreferenced.
        await removeObject(objectPath).catch(() => undefined);
        throw error;
    }

    if (previous.path && previous.path !== objectPath) {
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
    if (!current.path) throw new NotFoundError(`This borrower has no ${kind} document.`);

    const url = await createSignedUrl(current.path, expiresInSeconds);
    return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
};

export const download = async (
    borrowerId: string,
    kind: IdentityDocumentKind,
): Promise<{ buffer: Buffer; fileName: string }> => {
    const current = await getCurrent(borrowerId, kind);
    if (!current.path) throw new NotFoundError(`This borrower has no ${kind} document.`);

    return { buffer: await downloadObject(current.path), fileName: current.name ?? `${kind}-document` };
};

/** Clears the columns first, then removes the object - so a storage failure cannot strand the row. */
export const remove = async (borrowerId: string, kind: IdentityDocumentKind): Promise<void> => {
    const current = await getCurrent(borrowerId, kind);
    if (!current.path) return;

    const cols = COLUMNS[kind];
    await db
        .update(borrowers)
        .set({ [cols.pathKey]: null, [cols.nameKey]: null })
        .where(eq(borrowers.id, borrowerId));

    await removeObject(current.path).catch(() => undefined);
};
