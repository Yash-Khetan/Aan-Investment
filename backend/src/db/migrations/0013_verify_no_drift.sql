-- Reconciles the Drizzle schema with the database's real `loan_status` type.
--
-- ACTIVE and NPA already exist in the database (added by an earlier `db:push`)
-- and the column already defaults to ACTIVE, but the code-side enum listed only
-- four values. That mismatch made every stored loan fail the API's own
-- validator, so saving an existing loan returned 422.
--
-- Written with IF NOT EXISTS so it is a no-op against a database that already
-- has these values, while still recording the corrected state in the snapshot
-- for future migration diffs.
ALTER TYPE "public"."loan_status" ADD VALUE IF NOT EXISTS 'ACTIVE' BEFORE 'OVERDUE';--> statement-breakpoint
ALTER TYPE "public"."loan_status" ADD VALUE IF NOT EXISTS 'NPA' BEFORE 'CLOSED';--> statement-breakpoint
ALTER TABLE "loans" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
