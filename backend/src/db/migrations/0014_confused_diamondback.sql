CREATE TYPE "public"."ledger_vch_type" AS ENUM('PAYMENT', 'RECEIPT', 'JOURNAL_INTEREST', 'JOURNAL_TDS');--> statement-breakpoint
CREATE TABLE "borrower_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"narration" text,
	"vch_type" "ledger_vch_type" NOT NULL,
	"vch_no" varchar(30) NOT NULL,
	"debit" numeric(18, 2),
	"credit" numeric(18, 2),
	"paired_entry_id" uuid,
	"accrual_month" date,
	"rate_percent" numeric(5, 2),
	"is_system_generated" boolean DEFAULT false NOT NULL,
	"sequence_no" bigserial NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "borrower_ledger_settings" (
	"borrower_id" uuid PRIMARY KEY NOT NULL,
	"default_interest_rate_percent" numeric(5, 2) DEFAULT '21' NOT NULL,
	"default_tds_rate_percent" numeric(5, 2) DEFAULT '10' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "borrower_ledger_entries" ADD CONSTRAINT "borrower_ledger_entries_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrower_ledger_settings" ADD CONSTRAINT "borrower_ledger_settings_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "borrower_ledger_borrower_idx" ON "borrower_ledger_entries" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "borrower_ledger_borrower_date_idx" ON "borrower_ledger_entries" USING btree ("borrower_id","entry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "borrower_ledger_vch_no_idx" ON "borrower_ledger_entries" USING btree ("borrower_id","vch_no");--> statement-breakpoint
CREATE UNIQUE INDEX "borrower_ledger_accrual_month_idx" ON "borrower_ledger_entries" USING btree ("borrower_id","accrual_month","vch_type");