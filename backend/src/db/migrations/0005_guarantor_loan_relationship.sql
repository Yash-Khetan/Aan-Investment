ALTER TABLE "guarantors" DROP CONSTRAINT "guarantors_borrower_id_borrowers_id_fk";--> statement-breakpoint
DROP INDEX "guarantor_borrower_idx";--> statement-breakpoint
ALTER TABLE "guarantors" RENAME COLUMN "borrower_id" TO "loan_id";--> statement-breakpoint
ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guarantor_loan_idx" ON "guarantors" USING btree ("loan_id");
