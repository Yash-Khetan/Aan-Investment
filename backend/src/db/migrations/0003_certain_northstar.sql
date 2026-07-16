CREATE TYPE "public"."penal_interest_base" AS ENUM('ENTIRE_OUTSTANDING', 'OVERDUE_INSTALLMENT_ONLY');--> statement-breakpoint
CREATE TYPE "public"."waterfall_bucket_type" AS ENUM('PENALTY', 'INTEREST', 'PRINCIPAL', 'SPECIFIC_TRANCHE');--> statement-breakpoint
CREATE TABLE "payment_waterfall_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"name" varchar(100),
	"is_current" boolean DEFAULT true,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_waterfall_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"waterfall_config_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"bucket_type" "waterfall_bucket_type" NOT NULL,
	"tranche_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "group_name" varchar(255);--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "approval_notes" text;--> statement-breakpoint
ALTER TABLE "interest_configs" ADD COLUMN "custom_formula" text;--> statement-breakpoint
ALTER TABLE "penal_interest_rules" ADD COLUMN "penal_base" "penal_interest_base" DEFAULT 'OVERDUE_INSTALLMENT_ONLY';--> statement-breakpoint
ALTER TABLE "payment_waterfall_configs" ADD CONSTRAINT "payment_waterfall_configs_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_waterfall_steps" ADD CONSTRAINT "payment_waterfall_steps_waterfall_config_id_payment_waterfall_configs_id_fk" FOREIGN KEY ("waterfall_config_id") REFERENCES "public"."payment_waterfall_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_waterfall_steps" ADD CONSTRAINT "payment_waterfall_steps_tranche_id_loan_tranches_id_fk" FOREIGN KEY ("tranche_id") REFERENCES "public"."loan_tranches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "waterfall_config_loan_idx" ON "payment_waterfall_configs" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "waterfall_config_current_idx" ON "payment_waterfall_configs" USING btree ("loan_id","is_current");--> statement-breakpoint
CREATE INDEX "waterfall_step_config_idx" ON "payment_waterfall_steps" USING btree ("waterfall_config_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waterfall_step_order_idx" ON "payment_waterfall_steps" USING btree ("waterfall_config_id","step_order");