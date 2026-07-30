ALTER TABLE "loans" ADD COLUMN "other_security_type" varchar(255);--> statement-breakpoint
ALTER TABLE "collaterals" ADD COLUMN "other_security_type" varchar(255);--> statement-breakpoint
ALTER TABLE "loans" ALTER COLUMN "security_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "loans" ALTER COLUMN "security_type" SET DEFAULT 'NONE'::text;--> statement-breakpoint
ALTER TABLE "collaterals" ALTER COLUMN "security_type" SET DATA TYPE text;--> statement-breakpoint
UPDATE "loans" SET "security_type" = 'OTHERS', "other_security_type" = 'Structured Credit' WHERE "security_type" = 'STRUCTURED_CREDIT';--> statement-breakpoint
UPDATE "collaterals" SET "security_type" = 'OTHERS', "other_security_type" = 'Structured Credit' WHERE "security_type" = 'STRUCTURED_CREDIT';--> statement-breakpoint
DROP TYPE "public"."security_type";--> statement-breakpoint
CREATE TYPE "public"."security_type" AS ENUM('PROPERTY', 'MORTGAGE', 'HYPOTHECATION_OF_RECEIVABLES', 'PERSONAL_GUARANTEE', 'CORPORATE_GUARANTEE', 'OTHERS', 'NONE');--> statement-breakpoint
ALTER TABLE "loans" ALTER COLUMN "security_type" SET DEFAULT 'NONE'::"public"."security_type";--> statement-breakpoint
ALTER TABLE "loans" ALTER COLUMN "security_type" SET DATA TYPE "public"."security_type" USING "security_type"::"public"."security_type";--> statement-breakpoint
ALTER TABLE "collaterals" ALTER COLUMN "security_type" SET DATA TYPE "public"."security_type" USING "security_type"::"public"."security_type";
