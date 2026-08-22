CREATE TYPE "public"."document_source" AS ENUM('IDENTITY', 'GENERAL');--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "source" "document_source" DEFAULT 'GENERAL' NOT NULL;--> statement-breakpoint
CREATE INDEX "doc_source_idx" ON "documents" USING btree ("owner_type","owner_id","source");