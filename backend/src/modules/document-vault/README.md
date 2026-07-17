# Document Vault

A generic, reusable file-storage module. Any other module (loans, borrowers,
collaterals, collections, ...) uploads, retrieves, lists, and deletes
documents through this module instead of talking to Supabase Storage or the
`documents` table directly.

## Purpose

- Loans upload sanction letters, loan agreements, mortgage deeds.
- Borrowers upload KYC documents.
- Collaterals upload property papers, valuation reports.
- Collections upload legal notices.

Every one of those is "a file attached to an entity." Document Vault is the
single place that knows how to store that file safely, generate a temporary
signed URL for it, list what's attached to an entity, and delete it — so
individual modules never reimplement upload validation, storage naming, or
signed-URL generation.

## Folder structure

```
document-vault/
  controllers/    Express request handlers — thin, delegate to services
  routes/         documentRouter — mounts controllers onto HTTP paths
  services/       DocumentService — all business logic lives here
  middleware/      Multer wrapper for multipart uploads
  validators/     Input assertions (entityType, entityId, mime, size)
  types/          TypeScript interfaces, no `any`
  utils/          Storage client, filename generation, logging, error mapping
  constants/      Bucket name, size limit, allowed MIME types
  index.ts        Public API — the only thing other modules should import
```

## Schema note — read before adding a new entity type

`documents.ownerType` is a **fixed Postgres enum** (`document_owner`):
`BORROWER`, `LOAN`, `PROPERTY`, `PROMOTER`, `GUARANTOR`. This module treats
that enum as the source of truth for `EntityType` (imported directly from
`db/schema`, so it can never drift out of sync). It does **not** hardcode a
separate list.

This means the module is generic in code, but bounded by the enum in the
database — a `entityType` like `"customer"` or `"collection"` will be
rejected until a migration adds that value to `document_owner`. This module
does not, and should not, modify the schema itself.

Similarly, `documents.documentType` is bound to the `document_type` enum
(`SANCTION_LETTER`, `KYC`, `MORTGAGE_DEED`, ... `OTHER`). Callers that don't
care about classification can omit it and it defaults to `"OTHER"`.

## Storage

- Files go into a single **private** Supabase Storage bucket (`documents`,
  see `constants/document.constants.ts`). The bucket is created on first use
  if it doesn't already exist.
- Uploaded files are stored under `{entityType}/{entityId}/{uuid}{ext}` —
  the original filename is **never** trusted or reused for the storage path,
  only kept as display metadata (`name` in the DB row).
- Downloads and previews are only ever available via time-limited **signed
  URLs**, or by proxying the bytes through `GET /documents/:id`. There is no
  public URL.

## Required environment variables

```
SUPABASE_URL=
SUPABASE_SECRET_KEY=   # service-role key — required for server-side Storage access
```

## Endpoints

| Method | Path                                   | Description                          |
|--------|-----------------------------------------|---------------------------------------|
| POST   | `/documents/upload`                     | Upload a file (`multipart/form-data`, field `file`) |
| GET    | `/documents/:id`                        | Download the file (proxied through this server) |
| DELETE | `/documents/:id`                        | Delete a document (storage + db)     |
| GET    | `/documents/entity/:entityType/:entityId` | List documents attached to an entity |
| GET    | `/documents/:id/signed-url`             | Get a temporary signed URL (`?expiresIn=<seconds>`, default 300) |

`POST /documents/upload` body fields (besides the file): `entityType`,
`entityId`, `documentType?`, `name?`, `remarks?`, `uploadedBy?`.

> `uploadedBy` is accepted as-is from the request for now — this module has
> no authentication of its own. Wire it to `req.user.id` once an auth
> middleware exists upstream of these routes.

## How other modules consume this

```ts
import { DocumentService } from "../document-vault";

// Uploading a sanction letter from the loans module
const metadata = await DocumentService.upload({
    entityType: "LOAN",
    entityId: loan.id,
    documentType: "SANCTION_LETTER",
    name: "Sanction Letter - March 2026",
    uploadedBy: currentUser.id,
    file: {
        buffer: fileBuffer,
        originalName: "sanction.pdf",
        mimeType: "application/pdf",
        size: fileBuffer.length,
    },
});

// Listing everything attached to a loan
const files = await DocumentService.list("LOAN", loan.id);

// Generating a link the frontend can use directly for 10 minutes
const { url, expiresAt } = await DocumentService.generateSignedUrl(metadata.id, 600);
```

Mounting the routes in the app entry point:

```ts
import { documentRouter } from "./modules/document-vault";

app.use("/documents", documentRouter);
```

## What this module intentionally does not do

- No versioning, OCR, virus scanning, compression, or image processing.
- No repositories/DAOs — Drizzle is used directly inside `DocumentService`.
- No authentication/authorization — that's the consuming app's job.
