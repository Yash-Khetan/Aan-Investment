CREATE TYPE "public"."audit_action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" "audit_action" NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
-- Lock the rows an import posted, dated by when that import was posted. The
-- column is only being caught up with what `source` has already recorded
-- since 0002, so nothing is arbitrarily locked: an entry is locked if and
-- only if an import posted it.
--
-- Rows left unlocked, deliberately: MANUAL (recorded by hand on the Ledger
-- tab) and SYSTEM (the ledger's own month-end Interest/TDS pairs, which it
-- recalculates). No earlier state is ambiguous — `ledger_imports` and the
-- IMPORT source arrived together in 0002, so no ledger entry can have come
-- from a sheet before there was a source to say so.
UPDATE "ledger_entries" AS "e"
SET "locked_at" = coalesce("i"."created_at", "e"."created_at", now())
FROM "ledger_imports" AS "i"
WHERE "e"."import_id" = "i"."id" AND "e"."source" = 'IMPORT' AND "e"."locked_at" IS NULL;--> statement-breakpoint
-- Belt and braces: an IMPORT row with no import record left to date it from.
UPDATE "ledger_entries" SET "locked_at" = coalesce("created_at", now())
WHERE "source" = 'IMPORT' AND "locked_at" IS NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_created_at_idx" ON "audit_logs" USING btree ("created_at");
