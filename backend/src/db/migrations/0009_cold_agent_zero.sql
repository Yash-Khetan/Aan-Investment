CREATE TYPE "public"."calculation_method" AS ENUM('RUNNING_BALANCE', 'SIMPLE_INTEREST');--> statement-breakpoint
ALTER TYPE "public"."interest_basis" ADD VALUE 'MONTHLY_RATE_ACTUAL_30';--> statement-breakpoint
ALTER TABLE "interest_configs" ADD COLUMN "include_opening_closing_days" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "interest_configs" ADD COLUMN "calculation_method" "calculation_method" DEFAULT 'SIMPLE_INTEREST';