ALTER TABLE "borrowers" ADD COLUMN "pan_doc_path" text;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "pan_doc_name" varchar(500);--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "aadhaar_doc_path" text;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "aadhaar_doc_name" varchar(500);--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "ckyc_doc_path" text;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "ckyc_doc_name" varchar(500);