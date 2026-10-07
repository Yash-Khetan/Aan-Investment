ALTER TABLE "ledger_entries" ADD COLUMN "effective_logged_at" timestamp with time zone;--> statement-breakpoint
-- Carry any identity scans already attached to borrowers over into documents,
-- where every document now lives, before the borrower columns go.
INSERT INTO "documents" ("owner_type", "owner_id", "document_type", "name", "file_name", "storage_path", "remarks")
SELECT 'BORROWER', "id", 'PAN_CARD', coalesce("pan_doc_name", 'PAN scan'), "pan_doc_name", "pan_doc_path", 'PAN scan'
FROM "borrowers" WHERE "pan_doc_path" IS NOT NULL;--> statement-breakpoint
INSERT INTO "documents" ("owner_type", "owner_id", "document_type", "name", "file_name", "storage_path", "remarks")
SELECT 'BORROWER', "id", 'AADHAAR', coalesce("aadhaar_doc_name", 'AADHAAR scan'), "aadhaar_doc_name", "aadhaar_doc_path", 'AADHAAR scan'
FROM "borrowers" WHERE "aadhaar_doc_path" IS NOT NULL;--> statement-breakpoint
INSERT INTO "documents" ("owner_type", "owner_id", "document_type", "name", "file_name", "storage_path", "remarks")
SELECT 'BORROWER', "id", 'KYC', coalesce("ckyc_doc_name", 'CKYC scan'), "ckyc_doc_name", "ckyc_doc_path", 'CKYC scan'
FROM "borrowers" WHERE "ckyc_doc_path" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "borrowers" DROP COLUMN "pan_doc_path";--> statement-breakpoint
ALTER TABLE "borrowers" DROP COLUMN "pan_doc_name";--> statement-breakpoint
ALTER TABLE "borrowers" DROP COLUMN "aadhaar_doc_path";--> statement-breakpoint
ALTER TABLE "borrowers" DROP COLUMN "aadhaar_doc_name";--> statement-breakpoint
ALTER TABLE "borrowers" DROP COLUMN "ckyc_doc_path";--> statement-breakpoint
ALTER TABLE "borrowers" DROP COLUMN "ckyc_doc_name";