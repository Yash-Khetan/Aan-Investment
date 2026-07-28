ALTER TYPE "public"."document_type" ADD VALUE 'PAN_CARD' BEFORE 'FINANCIAL_STATEMENT';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'GSTIN_CERTIFICATE' BEFORE 'FINANCIAL_STATEMENT';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'AADHAAR' BEFORE 'FINANCIAL_STATEMENT';--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "aadhaar" varchar(12);
