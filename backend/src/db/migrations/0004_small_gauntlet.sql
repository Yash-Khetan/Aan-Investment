CREATE TYPE "public"."change_request_action" AS ENUM('CREATE', 'UPDATE', 'DELETE');--> statement-breakpoint
CREATE TYPE "public"."change_request_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"action" "change_request_action" NOT NULL,
	"payload" jsonb,
	"previous_values" jsonb,
	"loan_id" uuid,
	"requested_by" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "change_request_status" DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "notif_read_idx";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "borrower_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "loan_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "recipient" varchar(255);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "trigger_type" varchar(50);--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_request_entity_idx" ON "change_requests" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "change_request_status_idx" ON "change_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "change_request_requested_by_idx" ON "change_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "change_request_loan_idx" ON "change_requests" USING btree ("loan_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notif_borrower_idx" ON "notifications" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "notif_loan_idx" ON "notifications" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "notif_created_at_idx" ON "notifications" USING btree ("created_at");
