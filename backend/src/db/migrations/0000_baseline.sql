CREATE TYPE "public"."address_category" AS ENUM('PERMANENT', 'RESIDENCE', 'OFFICE', 'NOT_CATEGORIZED');--> statement-breakpoint
CREATE TYPE "public"."applicant_type" AS ENUM('APPLICANT', 'CO_APPLICANT');--> statement-breakpoint
CREATE TYPE "public"."asset_classification" AS ENUM('STANDARD', 'SUBSTANDARD', 'DOUBTFUL', 'LOSS', 'SPECIAL_MENTION_ACCOUNT');--> statement-breakpoint
CREATE TYPE "public"."borrower_type" AS ENUM('CONSUMER', 'COMMERCIAL');--> statement-breakpoint
CREATE TYPE "public"."business_category" AS ENUM('MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'OTHERS', 'RETAIL', 'AGRI');--> statement-breakpoint
CREATE TYPE "public"."business_type" AS ENUM('MANUFACTURING', 'DISTRIBUTION', 'WHOLESALE', 'TRADING', 'BROKING', 'SERVICE_PROVIDER', 'IMPORTING', 'EXPORTING', 'AGRICULTURE', 'DEALERS', 'OTHERS');--> statement-breakpoint
CREATE TYPE "public"."cibil_account_status" AS ENUM('OPEN', 'CLOSED_BY_PAYMENT', 'SETTLED_AND_CLOSED', 'RESTRUCTURED', 'WRITTEN_OFF', 'SETTLED_POST_WRITE_OFF', 'INVOKED', 'DEVOLVED', 'RESTRUCTURED_DUE_TO_NATURAL_CALAMITY', 'SOLD_TO_ARC', 'PURCHASE_FROM_BANK');--> statement-breakpoint
CREATE TYPE "public"."cibil_collateral_type" AS ENUM('NO_COLLATERAL', 'GOLD', 'SHARES', 'SAVINGS_ACCOUNT_AND_FIXED_DEPOSIT', 'MULTIPLE_SECURITIES', 'OTHERS');--> statement-breakpoint
CREATE TYPE "public"."cibil_credit_type" AS ENUM('CASH_CREDIT', 'OVERDRAFT', 'DEMAND_LOAN', 'LOAN_THROUGH_CREDIT_CARDS', 'MEDIUM_TERM_LOAN', 'LONG_TERM_LOAN', 'PACKING_CREDIT', 'EXPORT_BILLS_PURCHASED', 'EXPORT_BILLS_DISCOUNTED', 'EXPORT_BILLS_ADVANCED_AGAINST', 'ADVANCES_AGAINST_EXPORT_INCENTIVES', 'INLAND_BILLS_PURCHASED', 'INLAND_BILLS_DISCOUNTED', 'ADVANCES_AGAINST_IMPORT_BILLS', 'FOREIGN_CURRENCY_CHEQUES_PURCHASED', 'LEASE_FINANCE', 'HIRE_PURCHASE', 'BANK_GUARANTEE', 'DEFERRED_PAYMENT_GUARANTEE', 'LETTERS_OF_CREDIT', 'CORPORATE_CREDIT_CARD', 'COMMERCIAL_VEHICLE_LOAN', 'EQUIPMENT_FINANCING', 'UNSECURED_BUSINESS_LOAN', 'SHORT_TERM_LOAN', 'AGGREGATION_FUND_BASED', 'AGGREGATION_NON_FUND_BASED', 'FACILITIES_INTERCHANGE', 'DERIVATIVES', 'PLAIN_VANILLA_FOREX_FORWARD', 'PLAIN_VANILLA_INT_RATE_SWAP', 'PLAIN_VANILLA_FX_OPTION', 'COMPLEX_INT_RATE_DERIVATIVE', 'COMPLEX_FX_DERIVATIVE_WITH_OPTION', 'CONTRACTS_PAST_PERFORMANCE_IMPORTS', 'CONTRACTS_PAST_PERFORMANCE_EXPORTS', 'AGGREGATE_BORROWINGS_SUIT_FILED', 'AUTO_LOAN', 'PROPERTY_LOAN', 'GOLD_LOAN', 'LOAN_AGAINST_SHARES_SECURITIES', 'HEALTHCARE_FINANCE', 'INFRASTRUCTURE_FINANCE', 'FACTORING_WITH_RECOURSE_SELLER', 'COMMERCIAL_PAPER', 'NCD_NON_CONVERTIBLE_DEBENTURES', 'UNHEDGED_FOREIGN_CURRENCY_EXPOSURE', 'PAYMENT_ACCOUNT', 'CURRENT_LOAN', 'ARC_SECURED_LOAN', 'ARC_UNSECURED_LOAN', 'SELLER_FINANCING', 'GECL_LOAN', 'MUDRA_TERM_LOAN', 'MUDRA_WORKING_CAPITAL', 'TEMPORARY_OVERDRAFT', 'FACTORING_WITHOUT_RECOURSE_BUYER', 'OVERDRAFT_AGAINST_FD', 'OVERDRAFT_AGAINST_SHARES_SECURITIES', 'OVERDRAFT_AGAINST_COLLATERAL', 'MERCHANT_ACQUIRING', 'GOVERNMENT_SPONSORED_LOAN', 'WORKING_CAPITAL_LOAN', 'THREE_WHEELER_LOAN', 'CREDIT_EXPOSURES_CONVERTED_TO_SECURITIES', 'OTHERS');--> statement-breakpoint
CREATE TYPE "public"."constitution" AS ENUM('INDIVIDUAL', 'PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'TRUST', 'HUF', 'OTHER', 'BUSINESS_ENTITY_CREATED_BY_STATUTE', 'CO_OPERATIVE_SOCIETY', 'ASSOCIATION_OF_PERSONS', 'GOVERNMENT', 'SELF_HELP_GROUP');--> statement-breakpoint
CREATE TYPE "public"."document_owner" AS ENUM('BORROWER', 'LOAN', 'PROPERTY', 'PROMOTER', 'GUARANTOR');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('SANCTION_LETTER', 'LOAN_AGREEMENT', 'MORTGAGE_DEED', 'HYPOTHECATION_DEED', 'DPN', 'BOARD_RESOLUTION', 'PERSONAL_GUARANTEE', 'CORPORATE_GUARANTEE', 'LEGAL_OPINION', 'VALUATION_REPORT', 'INSURANCE', 'KYC', 'PAN_CARD', 'GSTIN_CERTIFICATE', 'AADHAAR', 'FINANCIAL_STATEMENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."entity_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE', 'OTHERS');--> statement-breakpoint
CREATE TYPE "public"."interest_basis" AS ENUM('ACTUAL_365', 'ACTUAL_360', 'MONTHLY_RATE_ACTUAL_30', 'FIXED_MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."ledger_vch_type" AS ENUM('PAYMENT', 'RECEIPT', 'JOURNAL_INTEREST', 'JOURNAL_TDS');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('PENDING', 'ACTIVE', 'CLOSED', 'WRITTEN_OFF');--> statement-breakpoint
CREATE TYPE "public"."loan_type" AS ENUM('SECURED', 'UNSECURED');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('SUCCESS', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."ownership_indicator" AS ENUM('INDIVIDUAL', 'AUTHORISED_USER', 'GUARANTOR', 'JOINT');--> statement-breakpoint
CREATE TYPE "public"."payment_frequency" AS ENUM('DAILY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'BULLET', 'ON_DEMAND', 'ROLLING', 'OTHERS');--> statement-breakpoint
CREATE TYPE "public"."related_person_relationship" AS ENUM('SHAREHOLDER', 'HOLDING_COMPANY', 'SUBSIDIARY_COMPANY', 'PROPRIETOR', 'PARTNER', 'TRUSTEE', 'PROMOTER_DIRECTOR', 'NOMINEE_DIRECTOR', 'INDEPENDENT_DIRECTOR', 'DIRECTOR_SINCE_RESIGNED', 'INDIVIDUAL_MEMBER_OF_SHG', 'OTHER_DIRECTOR', 'KARTA_HUF', 'OTHERS');--> statement-breakpoint
CREATE TYPE "public"."related_person_type" AS ENUM('RESIDENT_INDIAN_INDIVIDUAL', 'BUSINESS_ENTITY_REGISTERED_IN_INDIA', 'BUSINESS_ENTITY_REGISTERED_OUTSIDE_INDIA', 'FOREIGN_NON_RESIDENT_INDIAN_INDIVIDUAL');--> statement-breakpoint
CREATE TYPE "public"."reminder_channel" AS ENUM('EMAIL', 'WHATSAPP', 'SMS');--> statement-breakpoint
CREATE TYPE "public"."repayment_type" AS ENUM('EMI', 'BULLET', 'INTEREST_ONLY', 'STRUCTURED', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."residence_code" AS ENUM('OWNED', 'RENTED');--> statement-breakpoint
CREATE TYPE "public"."security_type" AS ENUM('PROPERTY', 'MORTGAGE', 'HYPOTHECATION_OF_RECEIVABLES', 'PERSONAL_GUARANTEE', 'CORPORATE_GUARANTEE', 'OTHERS', 'NONE');--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token" text NOT NULL,
	"ip_address" varchar(100),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(150) NOT NULL,
	"last_name" varchar(150),
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"password_hash" varchar(255) NOT NULL,
	"is_email_verified" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "borrowers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_type" "borrower_type" DEFAULT 'COMMERCIAL' NOT NULL,
	"borrower_code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"group_name" varchar(255),
	"constitution" "constitution" NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"alternate_phone" varchar(20),
	"address_line_1" text,
	"address_line_2" text,
	"city" varchar(100),
	"district" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10),
	"pan" varchar(10),
	"gst" varchar(20),
	"cin" varchar(25),
	"aadhaar" varchar(12),
	"pan_doc_path" text,
	"pan_doc_name" varchar(500),
	"aadhaar_doc_path" text,
	"aadhaar_doc_name" varchar(500),
	"ckyc_doc_path" text,
	"ckyc_doc_name" varchar(500),
	"date_of_incorporation" date,
	"nature_of_business" text,
	"gender" "gender",
	"date_of_birth" date,
	"address_category" "address_category",
	"residence_code" "residence_code",
	"ownership_indicator" "ownership_indicator",
	"ckyc_number" varchar(14),
	"business_category" "business_category",
	"business_type" "business_type",
	"class_of_activity_1" varchar(5),
	"applicant_type" "applicant_type",
	"internal_rating" varchar(10),
	"rating_remarks" text,
	"relationship_manager_id" uuid,
	"status" "entity_status" DEFAULT 'ACTIVE',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "promoters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"designation" varchar(150),
	"gender" "gender",
	"related_person_type" "related_person_type",
	"relationship" "related_person_relationship",
	"date_of_birth" date,
	"pan" varchar(10),
	"aadhar" varchar(12),
	"din" varchar(20),
	"phone" varchar(20),
	"email" varchar(255),
	"address_line_1" text,
	"city" varchar(100),
	"district" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10),
	"shareholding_percent" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_account_number" varchar(50) NOT NULL,
	"borrower_id" uuid NOT NULL,
	"loan_type" "loan_type" NOT NULL,
	"security_type" "security_type" DEFAULT 'NONE',
	"other_security_type" varchar(255),
	"repayment_type" "repayment_type" NOT NULL,
	"sanctioned_amount" numeric(18, 2) NOT NULL,
	"tenure_months" integer NOT NULL,
	"moratorium_months" integer DEFAULT 0,
	"sanction_date" date,
	"maturity_date" date,
	"purpose" text,
	"approval_notes" text,
	"remarks" text,
	"status" "loan_status" DEFAULT 'ACTIVE',
	"credit_type" "cibil_credit_type",
	"cibil_account_status" "cibil_account_status",
	"asset_classification" "asset_classification",
	"payment_frequency" "payment_frequency",
	"emi_amount" numeric(18, 2),
	"collateral_type" "cibil_collateral_type",
	"collateral_value" numeric(18, 2),
	"created_by" uuid,
	"relationship_manager_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "guarantors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"guarantee_type" varchar(50) NOT NULL,
	"pan" varchar(10),
	"phone" varchar(20),
	"email" varchar(255),
	"address_line_1" text,
	"city" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10),
	"net_worth" numeric(18, 2),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interest_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"annual_rate" numeric(8, 4) NOT NULL,
	"tds_rate_percent" numeric(5, 2) DEFAULT '10' NOT NULL,
	"interest_basis" "interest_basis" NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"is_current" boolean DEFAULT true NOT NULL,
	"remarks" text,
	"include_opening_closing_days" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "collateral_insurance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collateral_id" uuid NOT NULL,
	"policy_number" varchar(100) NOT NULL,
	"insurer" varchar(255),
	"insured_amount" numeric(18, 2),
	"premium_amount" numeric(18, 2),
	"start_date" date,
	"expiry_date" date,
	"status" "entity_status" DEFAULT 'ACTIVE',
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "collaterals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"owner_id" uuid,
	"security_type" "security_type" NOT NULL,
	"other_security_type" varchar(255),
	"description" text,
	"property_type" varchar(100),
	"property_address" text,
	"survey_number" varchar(100),
	"area_in_sq_ft" numeric(12, 2),
	"estimated_value" numeric(18, 2),
	"valuation_date" date,
	"valuation_by" varchar(255),
	"mortgage_type" varchar(50),
	"mortgage_date" date,
	"mortgage_deed_number" varchar(100),
	"status" "entity_status" DEFAULT 'ACTIVE',
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "document_owner" NOT NULL,
	"owner_id" uuid NOT NULL,
	"document_type" "document_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"file_name" varchar(500),
	"file_url" text,
	"storage_path" text,
	"mime_type" varchar(100),
	"file_size_bytes" integer,
	"version" integer DEFAULT 1,
	"is_verified" boolean DEFAULT false,
	"verified_by" uuid,
	"uploaded_by" uuid,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"type" varchar(50),
	"channel" "reminder_channel" NOT NULL,
	"status" "notification_status" NOT NULL,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp with time zone,
	"link" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"narration" text,
	"vch_type" "ledger_vch_type" NOT NULL,
	"vch_no" varchar(30) NOT NULL,
	"debit" numeric(18, 2),
	"credit" numeric(18, 2),
	"paired_entry_id" uuid,
	"accrual_month" date,
	"rate_percent" numeric(5, 2),
	"interest_basis" "interest_basis",
	"include_opening_closing_days" boolean,
	"is_system_generated" boolean DEFAULT false NOT NULL,
	"sequence_no" bigserial NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kpi_ledger_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"row_index" integer NOT NULL,
	"entry_date" text,
	"particulars" text DEFAULT '' NOT NULL,
	"vch_type" varchar(100),
	"vch_no" varchar(100),
	"debit" text,
	"credit" text,
	"balance" text,
	"source_file_name" varchar(255),
	"source_meta" text,
	"imported_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_relationship_manager_id_users_id_fk" FOREIGN KEY ("relationship_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_relationship_manager_id_users_id_fk" FOREIGN KEY ("relationship_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_configs" ADD CONSTRAINT "interest_configs_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collateral_insurance" ADD CONSTRAINT "collateral_insurance_collateral_id_collaterals_id_fk" FOREIGN KEY ("collateral_id") REFERENCES "public"."collaterals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaterals" ADD CONSTRAINT "collaterals_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaterals" ADD CONSTRAINT "collaterals_owner_id_borrowers_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_ledger_rows" ADD CONSTRAINT "kpi_ledger_rows_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_ledger_rows" ADD CONSTRAINT "kpi_ledger_rows_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_token_idx" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "permission_name_idx" ON "permissions" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permission_idx" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_name_idx" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_idx" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "borrower_code_idx" ON "borrowers" USING btree ("borrower_code");--> statement-breakpoint
CREATE INDEX "borrower_pan_idx" ON "borrowers" USING btree ("pan");--> statement-breakpoint
CREATE INDEX "borrower_rm_idx" ON "borrowers" USING btree ("relationship_manager_id");--> statement-breakpoint
CREATE INDEX "borrower_type_idx" ON "borrowers" USING btree ("borrower_type");--> statement-breakpoint
CREATE INDEX "promoter_borrower_idx" ON "promoters" USING btree ("borrower_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_account_idx" ON "loans" USING btree ("loan_account_number");--> statement-breakpoint
CREATE INDEX "loan_borrower_idx" ON "loans" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "loan_status_idx" ON "loans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loan_rm_idx" ON "loans" USING btree ("relationship_manager_id");--> statement-breakpoint
CREATE INDEX "guarantor_loan_idx" ON "guarantors" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "interest_config_loan_idx" ON "interest_configs" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "interest_config_current_idx" ON "interest_configs" USING btree ("loan_id","is_current");--> statement-breakpoint
CREATE INDEX "insurance_collateral_idx" ON "collateral_insurance" USING btree ("collateral_id");--> statement-breakpoint
CREATE INDEX "insurance_expiry_idx" ON "collateral_insurance" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "collateral_loan_idx" ON "collaterals" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "collateral_owner_idx" ON "collaterals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "doc_owner_idx" ON "documents" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "doc_type_idx" ON "documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "notif_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notif_read_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "notif_channel_idx" ON "notifications" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "notif_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ledger_loan_idx" ON "ledger_entries" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "ledger_loan_date_idx" ON "ledger_entries" USING btree ("loan_id","entry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_vch_no_idx" ON "ledger_entries" USING btree ("loan_id","vch_no");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accrual_month_idx" ON "ledger_entries" USING btree ("loan_id","accrual_month","vch_type");--> statement-breakpoint
CREATE INDEX "kpi_ledger_loan_idx" ON "kpi_ledger_rows" USING btree ("loan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_ledger_loan_row_idx" ON "kpi_ledger_rows" USING btree ("loan_id","row_index");