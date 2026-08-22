import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import path from "node:path";

/**
 * Supabase Storage access for borrower identity scans.
 *
 * Deliberately self-contained rather than reaching into the document-vault
 * module: these scans are part of the borrower master record and never appear
 * as rows in that module's `documents` table. Only the bucket is shared, under
 * a distinct `borrower-identity/` prefix so the two never collide.
 */

const BUCKET_NAME = "Aan_documents";
const OBJECT_PREFIX = "borrower-identity";

/** Matches the document vault's cap, so the two behave the same way for users. */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Photos only. Identity scans are meant to be readable by OCR, and Tesseract
 * reads pixels - a PDF has nothing for it to look at - so accepting one would
 * store a file the auto-read could never use.
 */
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"] as const;

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
    if (client) return client;

    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!url || !secretKey) {
        throw new Error(
            "Borrower identity document storage is not configured. Missing required environment variable(s): SUPABASE_URL, SUPABASE_SECRET_KEY.",
        );
    }

    client = createClient(url, secretKey, { auth: { persistSession: false } });
    return client;
}

/**
 * Object key for a scan. The user's filename is never reused as the key - only
 * its extension survives - so a hostile or duplicate name cannot influence
 * where the object lands.
 */
export function buildObjectPath(borrowerId: string, originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    return `${OBJECT_PREFIX}/${borrowerId}/${randomUUID()}${ext}`;
}

export async function uploadObject(objectPath: string, buffer: Buffer, contentType: string): Promise<void> {
    const { error } = await getClient()
        .storage.from(BUCKET_NAME)
        .upload(objectPath, buffer, { contentType, upsert: false });

    if (error) throw new Error(`Failed to upload identity document: ${error.message}`);
}

export async function createSignedUrl(objectPath: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await getClient()
        .storage.from(BUCKET_NAME)
        .createSignedUrl(objectPath, expiresInSeconds);

    if (error || !data) {
        throw new Error(`Failed to create signed URL: ${error?.message ?? "unknown error"}`);
    }
    return data.signedUrl;
}

export async function downloadObject(objectPath: string): Promise<Buffer> {
    const { data, error } = await getClient().storage.from(BUCKET_NAME).download(objectPath);

    if (error || !data) {
        throw new Error(`Failed to download identity document: ${error?.message ?? "unknown error"}`);
    }
    return Buffer.from(await data.arrayBuffer());
}

/** Best-effort removal. A missing object is not an error - the row is going away regardless. */
export async function removeObject(objectPath: string): Promise<void> {
    const { error } = await getClient().storage.from(BUCKET_NAME).remove([objectPath]);
    if (error) throw new Error(`Failed to remove identity document: ${error.message}`);
}
