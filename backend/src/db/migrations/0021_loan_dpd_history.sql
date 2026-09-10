CREATE TABLE "loan_dpd_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"month_start" date NOT NULL,
	"dpd_days" integer DEFAULT 0 NOT NULL,
	"bucket" integer DEFAULT 0 NOT NULL,
	"amount_overdue" numeric(18, 2) DEFAULT '0',
	"oldest_overdue_due_date" date,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "loan_dpd_history" ADD CONSTRAINT "loan_dpd_history_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dpd_history_loan_idx" ON "loan_dpd_history" USING btree ("loan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dpd_history_month_idx" ON "loan_dpd_history" USING btree ("loan_id","month_start");