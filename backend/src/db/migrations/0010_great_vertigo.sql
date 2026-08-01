ALTER TABLE "installments" ADD COLUMN "outstanding_balance" numeric(18, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "repayment_schedules" ADD COLUMN "generated_principal" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "repayment_schedules" ADD COLUMN "generated_annual_rate" numeric(8, 4);--> statement-breakpoint
ALTER TABLE "repayment_schedules" ADD COLUMN "generated_interest_basis" "interest_basis";--> statement-breakpoint
ALTER TABLE "repayment_schedules" ADD COLUMN "generated_calculation_method" "calculation_method";--> statement-breakpoint
ALTER TABLE "repayment_schedules" ADD COLUMN "generated_tenure_months" integer;--> statement-breakpoint
ALTER TABLE "repayment_schedules" ADD COLUMN "generated_disbursement_date" date;