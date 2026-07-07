CREATE TYPE "public"."accounting_entry_type" AS ENUM('DISBURSEMENT', 'INTEREST_ACCRUAL', 'INTEREST_RECEIPT', 'PRINCIPAL_RECEIPT', 'PENAL_INTEREST', 'WRITE_OFF');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT');--> statement-breakpoint
CREATE TYPE "public"."collection_status" AS ENUM('OPEN', 'PROMISE_TO_PAY', 'FOLLOW_UP', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."constitution" AS ENUM('INDIVIDUAL', 'PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'TRUST', 'HUF', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."document_owner" AS ENUM('BORROWER', 'LOAN', 'PROPERTY', 'PROMOTER', 'GUARANTOR');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('SANCTION_LETTER', 'LOAN_AGREEMENT', 'MORTGAGE_DEED', 'DPN', 'BOARD_RESOLUTION', 'PERSONAL_GUARANTEE', 'CORPORATE_GUARANTEE', 'LEGAL_OPINION', 'VALUATION_REPORT', 'INSURANCE', 'KYC', 'FINANCIAL_STATEMENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."entity_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."interest_basis" AS ENUM('ACTUAL_365', 'ACTUAL_360', 'THIRTY_360', 'MONTHLY', 'FIXED_MONTHLY', 'FULL_MONTH', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."interest_rule_type" AS ENUM('NORMAL', 'STEP_UP', 'STEP_DOWN', 'EVENT_BASED', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('PENDING', 'ACTIVE', 'OVERDUE', 'NPA', 'CLOSED', 'WRITTEN_OFF');--> statement-breakpoint
CREATE TYPE "public"."loan_type" AS ENUM('SECURED', 'UNSECURED');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('NEFT', 'RTGS', 'IMPS', 'UPI', 'CHEQUE', 'CASH', 'BANK_TRANSFER', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PARTIAL', 'SUCCESS', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."penal_interest_type" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT');--> statement-breakpoint
CREATE TYPE "public"."reminder_channel" AS ENUM('EMAIL', 'WHATSAPP', 'SMS');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('PENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."repayment_type" AS ENUM('EMI', 'BULLET', 'INTEREST_ONLY', 'STRUCTURED', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RELATIONSHIP_MANAGER', 'OPERATIONS', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."security_type" AS ENUM('PROPERTY', 'MORTGAGE', 'STRUCTURED_CREDIT', 'PERSONAL_GUARANTEE', 'CORPORATE_GUARANTEE', 'NONE');--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
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
	"borrower_code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"constitution" "constitution" NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"alternate_phone" varchar(20),
	"address_line_1" text,
	"address_line_2" text,
	"city" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10),
	"pan" varchar(10),
	"gst" varchar(20),
	"cin" varchar(25),
	"date_of_incorporation" date,
	"nature_of_business" text,
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
CREATE TABLE "guarantors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
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
CREATE TABLE "promoters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"designation" varchar(150),
	"pan" varchar(10),
	"aadhar" varchar(12),
	"din" varchar(20),
	"phone" varchar(20),
	"email" varchar(255),
	"address_line_1" text,
	"city" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10),
	"shareholding_percent" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "loan_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"from_status" "loan_status",
	"to_status" "loan_status" NOT NULL,
	"changed_by" uuid,
	"reason" text,
	"changed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_tranches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"tranche_number" integer NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"disbursement_date" date,
	"remarks" text,
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
	"repayment_type" "repayment_type" NOT NULL,
	"sanctioned_amount" numeric(18, 2) NOT NULL,
	"disbursed_amount" numeric(18, 2) DEFAULT '0',
	"outstanding_principal" numeric(18, 2) DEFAULT '0',
	"interest_rate" numeric(8, 4) NOT NULL,
	"tenure_months" integer NOT NULL,
	"moratorium_months" integer DEFAULT 0,
	"sanction_date" date,
	"first_disbursement_date" date,
	"maturity_date" date,
	"purpose" text,
	"remarks" text,
	"status" "loan_status" DEFAULT 'PENDING',
	"created_by" uuid,
	"relationship_manager_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interest_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"annual_rate" numeric(8, 4) NOT NULL,
	"interest_basis" "interest_basis" NOT NULL,
	"rule_type" "interest_rule_type" DEFAULT 'NORMAL',
	"effective_from" date NOT NULL,
	"effective_to" date,
	"is_current" boolean DEFAULT true,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interest_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interest_config_id" uuid NOT NULL,
	"from_month" integer,
	"to_month" integer,
	"rate" numeric(8, 4) NOT NULL,
	"trigger_event" varchar(255),
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "penal_interest_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"penal_type" "penal_interest_type" NOT NULL,
	"penal_rate" numeric(8, 4),
	"penal_amount" numeric(18, 2),
	"grace_period_days" integer DEFAULT 0,
	"is_current" boolean DEFAULT true,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"installment_number" integer NOT NULL,
	"due_date" date NOT NULL,
	"principal_amount" numeric(18, 2) DEFAULT '0',
	"interest_amount" numeric(18, 2) DEFAULT '0',
	"total_amount" numeric(18, 2) DEFAULT '0',
	"paid_principal" numeric(18, 2) DEFAULT '0',
	"paid_interest" numeric(18, 2) DEFAULT '0',
	"paid_total" numeric(18, 2) DEFAULT '0',
	"status" "payment_status" DEFAULT 'PENDING',
	"paid_date" date,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "repayment_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"installment_id" uuid,
	"principal_applied" numeric(18, 2) DEFAULT '0',
	"interest_applied" numeric(18, 2) DEFAULT '0',
	"penal_interest_applied" numeric(18, 2) DEFAULT '0',
	"other_charges" numeric(18, 2) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_ref_number" varchar(50) NOT NULL,
	"loan_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"value_date" date,
	"payment_mode" "payment_mode" NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING',
	"transaction_ref" varchar(100),
	"received_by" uuid,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "charge_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collateral_id" uuid NOT NULL,
	"charge_type" varchar(50) NOT NULL,
	"registration_number" varchar(100),
	"registration_date" date,
	"satisfaction_date" date,
	"status" "entity_status" DEFAULT 'ACTIVE',
	"remarks" text,
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
	"ltv_ratio" numeric(5, 2),
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
CREATE TABLE "collection_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"borrower_id" uuid NOT NULL,
	"status" "collection_status" DEFAULT 'OPEN',
	"assigned_to" uuid,
	"priority" integer DEFAULT 0,
	"overdue_amount" numeric(18, 2),
	"next_follow_up_date" date,
	"resolution_date" date,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_case_id" uuid NOT NULL,
	"follow_up_date" date NOT NULL,
	"follow_up_type" varchar(50) NOT NULL,
	"contact_person" varchar(255),
	"remarks" text,
	"follow_up_by" uuid,
	"promise_date" date,
	"promise_amount" numeric(18, 2),
	"promise_kept" boolean,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"borrower_id" uuid,
	"channel" "reminder_channel" NOT NULL,
	"scheduled_date" date NOT NULL,
	"sent_at" timestamp with time zone,
	"status" "reminder_status" DEFAULT 'PENDING',
	"subject" varchar(255),
	"message" text,
	"recipient_contact" varchar(255),
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" varchar(50) NOT NULL,
	"loan_id" uuid,
	"payment_id" uuid,
	"entry_type" "accounting_entry_type" NOT NULL,
	"entry_date" date NOT NULL,
	"narration" text,
	"is_posted" boolean DEFAULT false,
	"is_exported" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"account_code" varchar(50) NOT NULL,
	"account_name" varchar(255),
	"debit_amount" numeric(18, 2) DEFAULT '0',
	"credit_amount" numeric(18, 2) DEFAULT '0',
	"narration" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "report_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(100),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "report_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_definition_id" uuid NOT NULL,
	"parameters" jsonb,
	"generated_by" uuid,
	"file_url" text,
	"format" varchar(20),
	"status" varchar(20) DEFAULT 'PENDING',
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" "audit_action" NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(100),
	"user_agent" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"type" varchar(50),
	"is_read" boolean DEFAULT false,
	"read_at" timestamp with time zone,
	"link" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text,
	"description" text,
	"category" varchar(100),
	"is_editable" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_relationship_manager_id_users_id_fk" FOREIGN KEY ("relationship_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_status_history" ADD CONSTRAINT "loan_status_history_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_status_history" ADD CONSTRAINT "loan_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_tranches" ADD CONSTRAINT "loan_tranches_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_relationship_manager_id_users_id_fk" FOREIGN KEY ("relationship_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_configs" ADD CONSTRAINT "interest_configs_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_rules" ADD CONSTRAINT "interest_rules_interest_config_id_interest_configs_id_fk" FOREIGN KEY ("interest_config_id") REFERENCES "public"."interest_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penal_interest_rules" ADD CONSTRAINT "penal_interest_rules_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_schedule_id_repayment_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."repayment_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repayment_schedules" ADD CONSTRAINT "repayment_schedules_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_records" ADD CONSTRAINT "charge_records_collateral_id_collaterals_id_fk" FOREIGN KEY ("collateral_id") REFERENCES "public"."collaterals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collateral_insurance" ADD CONSTRAINT "collateral_insurance_collateral_id_collaterals_id_fk" FOREIGN KEY ("collateral_id") REFERENCES "public"."collaterals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaterals" ADD CONSTRAINT "collaterals_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaterals" ADD CONSTRAINT "collaterals_owner_id_borrowers_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_cases" ADD CONSTRAINT "collection_cases_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_cases" ADD CONSTRAINT "collection_cases_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_cases" ADD CONSTRAINT "collection_cases_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_collection_case_id_collection_cases_id_fk" FOREIGN KEY ("collection_case_id") REFERENCES "public"."collection_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_follow_up_by_users_id_fk" FOREIGN KEY ("follow_up_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_report_definition_id_report_definitions_id_fk" FOREIGN KEY ("report_definition_id") REFERENCES "public"."report_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_token_idx" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "role_name_idx" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_idx" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "borrower_code_idx" ON "borrowers" USING btree ("borrower_code");--> statement-breakpoint
CREATE INDEX "borrower_pan_idx" ON "borrowers" USING btree ("pan");--> statement-breakpoint
CREATE INDEX "borrower_rm_idx" ON "borrowers" USING btree ("relationship_manager_id");--> statement-breakpoint
CREATE INDEX "guarantor_borrower_idx" ON "guarantors" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "promoter_borrower_idx" ON "promoters" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "status_history_loan_idx" ON "loan_status_history" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "tranche_loan_idx" ON "loan_tranches" USING btree ("loan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_account_idx" ON "loans" USING btree ("loan_account_number");--> statement-breakpoint
CREATE INDEX "loan_borrower_idx" ON "loans" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "loan_status_idx" ON "loans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loan_rm_idx" ON "loans" USING btree ("relationship_manager_id");--> statement-breakpoint
CREATE INDEX "interest_config_loan_idx" ON "interest_configs" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "interest_config_current_idx" ON "interest_configs" USING btree ("loan_id","is_current");--> statement-breakpoint
CREATE INDEX "interest_rule_config_idx" ON "interest_rules" USING btree ("interest_config_id");--> statement-breakpoint
CREATE INDEX "penal_rule_loan_idx" ON "penal_interest_rules" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "installment_sched_idx" ON "installments" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "installment_due_idx" ON "installments" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "installment_status_idx" ON "installments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sched_loan_idx" ON "repayment_schedules" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "sched_current_idx" ON "repayment_schedules" USING btree ("loan_id","is_current");--> statement-breakpoint
CREATE INDEX "allocation_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "allocation_installment_idx" ON "payment_allocations" USING btree ("installment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_ref_idx" ON "payments" USING btree ("payment_ref_number");--> statement-breakpoint
CREATE INDEX "payment_loan_idx" ON "payments" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "payment_date_idx" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "charge_collateral_idx" ON "charge_records" USING btree ("collateral_id");--> statement-breakpoint
CREATE INDEX "insurance_collateral_idx" ON "collateral_insurance" USING btree ("collateral_id");--> statement-breakpoint
CREATE INDEX "insurance_expiry_idx" ON "collateral_insurance" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "collateral_loan_idx" ON "collaterals" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "collateral_owner_idx" ON "collaterals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "doc_owner_idx" ON "documents" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "doc_type_idx" ON "documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "collection_loan_idx" ON "collection_cases" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "collection_status_idx" ON "collection_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "collection_assigned_idx" ON "collection_cases" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "collection_follow_up_idx" ON "collection_cases" USING btree ("next_follow_up_date");--> statement-breakpoint
CREATE INDEX "follow_up_case_idx" ON "follow_ups" USING btree ("collection_case_id");--> statement-breakpoint
CREATE INDEX "follow_up_date_idx" ON "follow_ups" USING btree ("follow_up_date");--> statement-breakpoint
CREATE INDEX "reminder_loan_idx" ON "reminders" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "reminder_status_idx" ON "reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reminder_date_idx" ON "reminders" USING btree ("scheduled_date");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entry_number_idx" ON "journal_entries" USING btree ("entry_number");--> statement-breakpoint
CREATE INDEX "journal_loan_idx" ON "journal_entries" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "journal_date_idx" ON "journal_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "line_entry_idx" ON "journal_entry_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "line_account_idx" ON "journal_entry_lines" USING btree ("account_code");--> statement-breakpoint
CREATE UNIQUE INDEX "report_slug_idx" ON "report_definitions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "report_run_def_idx" ON "report_runs" USING btree ("report_definition_id");--> statement-breakpoint
CREATE INDEX "report_run_user_idx" ON "report_runs" USING btree ("generated_by");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notif_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notif_read_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE UNIQUE INDEX "setting_key_idx" ON "system_settings" USING btree ("key");