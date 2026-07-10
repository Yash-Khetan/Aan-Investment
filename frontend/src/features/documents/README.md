# Documents Feature

Upload, list, download, and delete files against a loan or borrower — real uploads to
Supabase Storage through the backend's `document-vault` module.

## API

All under `/documents`, returning the resource directly (no wrapper):

- `POST /documents/upload` — `multipart/form-data`: `entityType`, `entityId`,
  `documentType`, `name?`, `remarks?`, `file`
- `GET /documents/entity/:entityType/:entityId` — list documents for an entity
- `GET /documents/:id` — streams the file itself (used for download, not JSON)
- `DELETE /documents/:id`

## Files

- `types.ts` — `ENTITY_TYPES` (this UI only offers `LOAN`/`BORROWER` — see root
  README's "Known Limitations"), `DOCUMENT_TYPES` (13 values), `DocumentMetadata`
- `api.ts` — `listDocuments`, `uploadDocument` (builds `FormData` and calls `fetch`
  directly rather than going through `apiRequest`, since the upload needs a raw
  `File` in the body, not JSON), `downloadDocument` (uses `lib/api.ts`'s
  `downloadFile` to trigger a real browser save), `deleteDocument`
- `DocumentsPage.tsx` — entity type toggle (Loan / Borrower) + picker + document list
  + "Upload" toggle
- `components/UploadDocumentForm.tsx` — native `<input type="file">`, document type
  select, optional display name
- `components/DocumentCard.tsx` — one document's metadata + Download/Delete buttons
