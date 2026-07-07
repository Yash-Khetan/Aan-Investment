import { randomUUID } from "node:crypto";
import path from "node:path";

/**
 * Generates a random, collision-safe filename for storage, preserving only
 * the original file's extension. The original filename is never trusted or
 * reused as-is — it's kept solely as display metadata (`name` in the DB row).
 */
export function generateStorageFileName(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    return `${randomUUID()}${ext}`;
}

/** Builds the storage object path for a document, namespaced by entity for easy browsing/auditing. */
export function buildStoragePath(entityType: string, entityId: string, storageFileName: string): string {
    return `${entityType.toLowerCase()}/${entityId}/${storageFileName}`;
}
