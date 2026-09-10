CREATE TABLE "kpi_ledger_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"row_index" integer NOT NULL,
	"entry_date" text,
	"particulars" text DEFAULT '' NOT NULL,
	"vch_type" varchar(100),
	"vch_no" varchar(100),
	"debit" text,
	"credit" text,
	"balance" text,
	"source_file_name" varchar(255),
	"imported_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "kpi_ledger_rows" ADD CONSTRAINT "kpi_ledger_rows_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_ledger_rows" ADD CONSTRAINT "kpi_ledger_rows_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kpi_ledger_loan_idx" ON "kpi_ledger_rows" USING btree ("loan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_ledger_loan_row_idx" ON "kpi_ledger_rows" USING btree ("loan_id","row_index");