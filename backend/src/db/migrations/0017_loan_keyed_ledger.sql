-- Re-keys the ledger from borrower to LOAN ACCOUNT.
--
-- Hand-written in place of the generated migration: drizzle-kit cannot tell a
-- table rename from a drop-and-create without an interactive prompt, and here
-- the intent is a drop-and-create. The existing rows are test data and are
-- discarded deliberately — a borrower's merged ledger cannot be split across
-- that borrower's several loan accounts by any rule the data supports.
--
-- The Interest/TDS rates move onto the loan row, so the loan is the single
-- source of truth for both: a rate edited on the Ledger page IS the loan's rate,
-- with no second copy to drift. The per-entry rate_percent column stays, so each
-- posted month keeps the rate it actually accrued at.

DROP TABLE IF EXISTS "borrower_ledger_settings" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "borrower_ledger_entries" CASCADE;
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "tds_rate_percent" numeric(5, 2) DEFAULT '10' NOT NULL;
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"narration" text,
	"vch_type" "public"."ledger_vch_type" NOT NULL,
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
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ledger_loan_idx" ON "ledger_entries" USING btree ("loan_id");
--> statement-breakpoint
CREATE INDEX "ledger_loan_date_idx" ON "ledger_entries" USING btree ("loan_id","entry_date");
--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_vch_no_idx" ON "ledger_entries" USING btree ("loan_id","vch_no");
--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accrual_month_idx" ON "ledger_entries" USING btree ("loan_id","accrual_month","vch_type");
