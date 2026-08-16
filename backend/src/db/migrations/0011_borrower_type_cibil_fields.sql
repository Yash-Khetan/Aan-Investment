CREATE TYPE "public"."address_category" AS ENUM('PERMANENT', 'RESIDENCE', 'OFFICE', 'NOT_CATEGORIZED');--> statement-breakpoint
CREATE TYPE "public"."applicant_type" AS ENUM('APPLICANT', 'CO_APPLICANT');--> statement-breakpoint
CREATE TYPE "public"."borrower_type" AS ENUM('CONSUMER', 'COMMERCIAL');--> statement-breakpoint
CREATE TYPE "public"."business_category" AS ENUM('MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'OTHERS', 'RETAIL', 'AGRI');--> statement-breakpoint
CREATE TYPE "public"."business_type" AS ENUM('MANUFACTURING', 'DISTRIBUTION', 'WHOLESALE', 'TRADING', 'BROKING', 'SERVICE_PROVIDER', 'IMPORTING', 'EXPORTING', 'AGRICULTURE', 'DEALERS', 'OTHERS');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE', 'TRANSGENDER');--> statement-breakpoint
CREATE TYPE "public"."ownership_indicator" AS ENUM('INDIVIDUAL', 'AUTHORISED_USER', 'GUARANTOR', 'JOINT');--> statement-breakpoint
CREATE TYPE "public"."related_person_relationship" AS ENUM('SHAREHOLDER', 'HOLDING_COMPANY', 'SUBSIDIARY_COMPANY', 'PROPRIETOR', 'PARTNER', 'TRUSTEE', 'PROMOTER_DIRECTOR', 'NOMINEE_DIRECTOR', 'INDEPENDENT_DIRECTOR', 'DIRECTOR_SINCE_RESIGNED', 'INDIVIDUAL_MEMBER_OF_SHG', 'OTHER_DIRECTOR', 'KARTA_HUF', 'OTHERS');--> statement-breakpoint
CREATE TYPE "public"."related_person_type" AS ENUM('RESIDENT_INDIAN_INDIVIDUAL', 'BUSINESS_ENTITY_REGISTERED_IN_INDIA', 'BUSINESS_ENTITY_REGISTERED_OUTSIDE_INDIA', 'FOREIGN_NON_RESIDENT_INDIAN_INDIVIDUAL');--> statement-breakpoint
CREATE TYPE "public"."residence_code" AS ENUM('OWNED', 'RENTED');--> statement-breakpoint
ALTER TYPE "public"."constitution" ADD VALUE 'BUSINESS_ENTITY_CREATED_BY_STATUTE';--> statement-breakpoint
ALTER TYPE "public"."constitution" ADD VALUE 'CO_OPERATIVE_SOCIETY';--> statement-breakpoint
ALTER TYPE "public"."constitution" ADD VALUE 'ASSOCIATION_OF_PERSONS';--> statement-breakpoint
ALTER TYPE "public"."constitution" ADD VALUE 'GOVERNMENT';--> statement-breakpoint
ALTER TYPE "public"."constitution" ADD VALUE 'SELF_HELP_GROUP';--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "borrower_type" "borrower_type" DEFAULT 'COMMERCIAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "district" varchar(100);--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "gender" "gender";--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "address_category" "address_category";--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "residence_code" "residence_code";--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "ownership_indicator" "ownership_indicator";--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "ckyc_number" varchar(14);--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "business_category" "business_category";--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "business_type" "business_type";--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "class_of_activity_1" varchar(5);--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "applicant_type" "applicant_type";--> statement-breakpoint
ALTER TABLE "promoters" ADD COLUMN "gender" "gender";--> statement-breakpoint
ALTER TABLE "promoters" ADD COLUMN "related_person_type" "related_person_type";--> statement-breakpoint
ALTER TABLE "promoters" ADD COLUMN "relationship" "related_person_relationship";--> statement-breakpoint
ALTER TABLE "promoters" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "promoters" ADD COLUMN "district" varchar(100);--> statement-breakpoint
CREATE INDEX "borrower_type_idx" ON "borrowers" USING btree ("borrower_type");--> statement-breakpoint
-- Backfill: existing borrowers predate the consumer/commercial split. The column
-- default already made every row COMMERCIAL; individuals and HUFs are the
-- consumer-bureau constitutions, so flip those.
UPDATE "borrowers" SET "borrower_type" = 'CONSUMER' WHERE "constitution" IN ('INDIVIDUAL', 'HUF');