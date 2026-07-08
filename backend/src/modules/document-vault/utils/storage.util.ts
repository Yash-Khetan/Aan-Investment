import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_NAME } from "../constants/document.constants";
import { StorageError } from "./errors";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
    if (client) {
        return client;
    }

    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!url || !secretKey) {
        throw new StorageError(
            "Document vault storage is not configured. Missing required environment variable(s): SUPABASE_URL, SUPABASE_SECRET_KEY."
        );
    }

    client = createClient(url, secretKey, {
        auth: { persistSession: false },
    });

    return client;
}

let bucketReady: Promise<void> | null = null;

/** Ensures the private documents bucket exists. Safe to call repeatedly — the check/create runs once per process. */
export function ensureBucketExists(): Promise<void> {
    if (bucketReady) {
        return bucketReady;
    }

    bucketReady = (async () => {
        const supabase = getClient();
        const { data: existing } = await supabase.storage.getBucket(BUCKET_NAME);

        if (existing) {
            return;
        }

        const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
            public: false,
        });

        if (createError && !/already exists/i.test(createError.message)) {
            throw new StorageError(`Failed to create storage bucket "${BUCKET_NAME}": ${createError.message}`, createError);
        }
    })();

    return bucketReady.catch((error) => {
        // Allow a later call to retry instead of permanently caching a failed setup attempt.
        bucketReady = null;
        throw error;
    });
}

export async function uploadObject(objectPath: string, buffer: Buffer, contentType: string): Promise<void> {
    await ensureBucketExists();
    const supabase = getClient();

    const { error } = await supabase.storage.from(BUCKET_NAME).upload(objectPath, buffer, {
        contentType,
        upsert: false,
    });

    if (error) {
        throw new StorageError(`Failed to upload object to storage: ${error.message}`, error);
    }
}

export async function downloadObject(objectPath: string): Promise<Buffer> {
    const supabase = getClient();

    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(objectPath);

    if (error || !data) {
        throw new StorageError(`Failed to download object from storage: ${error?.message ?? "unknown error"}`, error);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

export async function removeObject(objectPath: string): Promise<void> {
    const supabase = getClient();

    const { error } = await supabase.storage.from(BUCKET_NAME).remove([objectPath]);

    if (error) {
        throw new StorageError(`Failed to remove object from storage: ${error.message}`, error);
    }
}

export async function createSignedUrl(objectPath: string, expiresInSeconds: number): Promise<string> {
    const supabase = getClient();

    const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(objectPath, expiresInSeconds);

    if (error || !data) {
        throw new StorageError(`Failed to create signed URL: ${error?.message ?? "unknown error"}`, error);
    }

    return data.signedUrl;
}
