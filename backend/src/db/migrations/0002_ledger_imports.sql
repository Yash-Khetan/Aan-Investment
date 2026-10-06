CREATE TYPE "public"."ledger_entry_source" AS ENUM('MANUAL', 'SYSTEM', 'IMPORT');--> statement-breakpoint
CREATE TABLE "ledger_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"file_name" varchar(255),
	"sheet_name" varchar(255),
	"meta" text,
	"row_count" integer NOT NULL,
	"first_entry_date" date NOT NULL,
	"last_entry_date" date NOT NULL,
	"last_interest_month" date,
	"closing_balance" numeric(18, 2) NOT NULL,
	"imported_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX "ledger_accrual_month_idx";--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "source" "ledger_entry_source" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
-- The month-end Interest/TDS pairs the ledger already posted are its own.
UPDATE "ledger_entries" SET "source" = 'SYSTEM' WHERE "is_system_generated" = true;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "import_id" uuid;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "source_vch_type" varchar(100);--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "source_vch_no" varchar(100);--> statement-breakpoint
ALTER TABLE "kpi_ledger_rows" ADD COLUMN "import_id" uuid;--> statement-breakpoint
ALTER TABLE "kpi_ledger_rows" ADD COLUMN "sheet_name" varchar(255);--> statement-breakpoint
ALTER TABLE "kpi_ledger_rows" ADD COLUMN "dr_cr" varchar(10);--> statement-breakpoint
ALTER TABLE "ledger_imports" ADD CONSTRAINT "ledger_imports_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_imports" ADD CONSTRAINT "ledger_imports_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_import_loan_idx" ON "ledger_imports" USING btree ("loan_id");--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_import_id_ledger_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."ledger_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_ledger_rows" ADD CONSTRAINT "kpi_ledger_rows_import_id_ledger_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."ledger_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_import_idx" ON "ledger_entries" USING btree ("import_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accrual_month_idx" ON "ledger_entries" USING btree ("loan_id","accrual_month","vch_type") WHERE "ledger_entries"."source" = 'SYSTEM';