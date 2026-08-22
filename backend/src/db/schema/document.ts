import {
    pgTable,
    uuid,
    varchar,
    text,
    boolean,
    integer,
    index,
} from "drizzle-orm/pg-core";

import {
    documentTypeEnum,
    documentOwnerEnum,
    timestamps,
} from "./shared";

import { users } from "./auth";

/* ============================================================
   DOCUMENTS
============================================================ */

export const documents = pgTable("documents", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    /* ── Polymorphic Owner ── */

    ownerType: documentOwnerEnum("owner_type")
        .notNull(),

    ownerId: uuid("owner_id")
        .notNull(),

    /* ── Document Info ── */

    documentType: documentTypeEnum("document_type")
        .notNull(),

    name: varchar("name", {
        length: 255,
    }).notNull(),

    fileName: varchar("file_name", {
        length: 500,
    }),

    fileUrl: text("file_url"),

    storagePath: text("storage_path"),

    mimeType: varchar("mime_type", {
        length: 100,
    }),

    fileSizeBytes: integer("file_size_bytes"),

    version: integer("version")
        .default(1),

    /* ── Verification ── */

    isVerified: boolean("is_verified")
        .default(false),

    verifiedBy: uuid("verified_by")
        .references(() => users.id),

    uploadedBy: uuid("uploaded_by")
        .references(() => users.id),

    remarks: text("remarks"),

    ...timestamps,

}, (table) => ({

    docOwnerIdx: index("doc_owner_idx")
        .on(table.ownerType, table.ownerId),

    docTypeIdx: index("doc_type_idx")
        .on(table.documentType),

}));
