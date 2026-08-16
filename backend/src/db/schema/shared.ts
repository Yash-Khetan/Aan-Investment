import {
    pgEnum,
    numeric,
    timestamp,
} from "drizzle-orm/pg-core";

/* ============================================================
   LOAN STATUS
============================================================ */

/**
 * Mirrors the `loan_status` type as it actually exists in the database.
 *
 * ACTIVE and NPA were present in the database but missing here, and the column
 * defaults to ACTIVE — so every stored loan failed the API's own validator and
 * could not be saved from the edit form. Keep this list in step with the DB.
 */
export const loanStatusEnum = pgEnum("loan_status", [
    "PENDING",
    "ACTIVE",
    "OVERDUE",
    "NPA",
    "CLOSED",
    "WRITTEN_OFF",
]);

/* ============================================================
   LOAN TYPES
============================================================ */

export const loanTypeEnum = pgEnum("loan_type", [
    "SECURED",
    "UNSECURED",
]);

/* ============================================================
   SECURITY TYPES
============================================================ */

export const securityTypeEnum = pgEnum("security_type", [
    "PROPERTY",
    "MORTGAGE",
    "HYPOTHECATION_OF_RECEIVABLES",
    "PERSONAL_GUARANTEE",
    "CORPORATE_GUARANTEE",
    "OTHERS",
    "NONE",
]);

/* ============================================================
   BORROWER CONSTITUTION
============================================================ */

export const constitutionEnum = pgEnum("constitution", [
    "INDIVIDUAL",
    "PROPRIETORSHIP",
    "PARTNERSHIP",
    "LLP",
    "PRIVATE_LIMITED",
    "PUBLIC_LIMITED",
    "TRUST",
    "HUF",
    "OTHER",
    /* CIBIL commercial "Borrower Legal Constitution" values not already covered. */
    "BUSINESS_ENTITY_CREATED_BY_STATUTE",
    "CO_OPERATIVE_SOCIETY",
    "ASSOCIATION_OF_PERSONS",
    "GOVERNMENT",
    "SELF_HELP_GROUP",
]);

/* ============================================================
   BORROWER TYPE

   Splits the borrower master into the two CIBIL submission
   formats: the consumer bureau (individuals) and the commercial
   bureau (companies, LLPs, firms, and other non-individuals).
============================================================ */

export const borrowerTypeEnum = pgEnum("borrower_type", [
    "CONSUMER",
    "COMMERCIAL",
]);

/* ============================================================
   CIBIL CONSUMER FIELDS
============================================================ */

export const genderEnum = pgEnum("gender", [
    "MALE",
    "FEMALE",
    "TRANSGENDER",
]);

/** CIBIL "Address Category": 01 Permanent, 02 Residence, 03 Office, 04 Not Categorized. */
export const addressCategoryEnum = pgEnum("address_category", [
    "PERMANENT",
    "RESIDENCE",
    "OFFICE",
    "NOT_CATEGORIZED",
]);

/** CIBIL "Residence Code": 01 Owned, 02 Rented. */
export const residenceCodeEnum = pgEnum("residence_code", [
    "OWNED",
    "RENTED",
]);

/** CIBIL "Ownership Indicator": 1 Individual, 2 Authorised User, 3 Guarantor, 4 Joint. */
export const ownershipIndicatorEnum = pgEnum("ownership_indicator", [
    "INDIVIDUAL",
    "AUTHORISED_USER",
    "GUARANTOR",
    "JOINT",
]);

/* ============================================================
   CIBIL COMMERCIAL FIELDS
============================================================ */

/** CIBIL "Business Category": 03 Micro … 09 Agri. */
export const businessCategoryEnum = pgEnum("business_category", [
    "MICRO",
    "SMALL",
    "MEDIUM",
    "LARGE",
    "OTHERS",
    "RETAIL",
    "AGRI",
]);

/** CIBIL "Business Type": 01 Manufacturing … 11 Others. */
export const businessTypeEnum = pgEnum("business_type", [
    "MANUFACTURING",
    "DISTRIBUTION",
    "WHOLESALE",
    "TRADING",
    "BROKING",
    "SERVICE_PROVIDER",
    "IMPORTING",
    "EXPORTING",
    "AGRICULTURE",
    "DEALERS",
    "OTHERS",
]);

/**
 * CIBIL commercial "Borrower Type" column (Applicant / Co-Applicant).
 * Named `applicant_type` here so it does not collide with the
 * consumer-vs-commercial `borrower_type` discriminator above.
 */
export const applicantTypeEnum = pgEnum("applicant_type", [
    "APPLICANT",
    "CO_APPLICANT",
]);

/** CIBIL commercial "Related Person (Related Type)". */
export const relatedPersonTypeEnum = pgEnum("related_person_type", [
    "RESIDENT_INDIAN_INDIVIDUAL",
    "BUSINESS_ENTITY_REGISTERED_IN_INDIA",
    "BUSINESS_ENTITY_REGISTERED_OUTSIDE_INDIA",
    "FOREIGN_NON_RESIDENT_INDIAN_INDIVIDUAL",
]);

/** CIBIL commercial "Related Person (Relationship)". */
export const relatedPersonRelationshipEnum = pgEnum(
    "related_person_relationship",
    [
        "SHAREHOLDER",
        "HOLDING_COMPANY",
        "SUBSIDIARY_COMPANY",
        "PROPRIETOR",
        "PARTNER",
        "TRUSTEE",
        "PROMOTER_DIRECTOR",
        "NOMINEE_DIRECTOR",
        "INDEPENDENT_DIRECTOR",
        "DIRECTOR_SINCE_RESIGNED",
        "INDIVIDUAL_MEMBER_OF_SHG",
        "OTHER_DIRECTOR",
        "KARTA_HUF",
        "OTHERS",
    ],
);

/* ============================================================
   CIBIL LOAN-LEVEL FIELDS

   These mirror the loan columns of the client's CIBIL workbook.
   They are deliberately separate from the existing operational
   enums (`loan_type`, `loan_status`, `repayment_type`,
   `security_type`), which describe how the business runs a loan
   rather than how CIBIL wants it reported.
============================================================ */

/**
 * CIBIL "CREDIT TYPE" (commercial sheet) — also used for the consumer sheet's
 * "ACCOUNT TYPE", which the workbook leaves un-enumerated.
 */
export const cibilCreditTypeEnum = pgEnum("cibil_credit_type", [
    "CASH_CREDIT",
    "OVERDRAFT",
    "DEMAND_LOAN",
    "LOAN_THROUGH_CREDIT_CARDS",
    "MEDIUM_TERM_LOAN",
    "LONG_TERM_LOAN",
    "PACKING_CREDIT",
    "EXPORT_BILLS_PURCHASED",
    "EXPORT_BILLS_DISCOUNTED",
    "EXPORT_BILLS_ADVANCED_AGAINST",
    "ADVANCES_AGAINST_EXPORT_INCENTIVES",
    "INLAND_BILLS_PURCHASED",
    "INLAND_BILLS_DISCOUNTED",
    "ADVANCES_AGAINST_IMPORT_BILLS",
    "FOREIGN_CURRENCY_CHEQUES_PURCHASED",
    "LEASE_FINANCE",
    "HIRE_PURCHASE",
    "BANK_GUARANTEE",
    "DEFERRED_PAYMENT_GUARANTEE",
    "LETTERS_OF_CREDIT",
    "CORPORATE_CREDIT_CARD",
    "COMMERCIAL_VEHICLE_LOAN",
    "EQUIPMENT_FINANCING",
    "UNSECURED_BUSINESS_LOAN",
    "SHORT_TERM_LOAN",
    "AGGREGATION_FUND_BASED",
    "AGGREGATION_NON_FUND_BASED",
    "FACILITIES_INTERCHANGE",
    "DERIVATIVES",
    "PLAIN_VANILLA_FOREX_FORWARD",
    "PLAIN_VANILLA_INT_RATE_SWAP",
    "PLAIN_VANILLA_FX_OPTION",
    "COMPLEX_INT_RATE_DERIVATIVE",
    "COMPLEX_FX_DERIVATIVE_WITH_OPTION",
    "CONTRACTS_PAST_PERFORMANCE_IMPORTS",
    "CONTRACTS_PAST_PERFORMANCE_EXPORTS",
    "AGGREGATE_BORROWINGS_SUIT_FILED",
    "AUTO_LOAN",
    "PROPERTY_LOAN",
    "GOLD_LOAN",
    "LOAN_AGAINST_SHARES_SECURITIES",
    "HEALTHCARE_FINANCE",
    "INFRASTRUCTURE_FINANCE",
    "FACTORING_WITH_RECOURSE_SELLER",
    "COMMERCIAL_PAPER",
    "NCD_NON_CONVERTIBLE_DEBENTURES",
    "UNHEDGED_FOREIGN_CURRENCY_EXPOSURE",
    "PAYMENT_ACCOUNT",
    "CURRENT_LOAN",
    "ARC_SECURED_LOAN",
    "ARC_UNSECURED_LOAN",
    "SELLER_FINANCING",
    "GECL_LOAN",
    "MUDRA_TERM_LOAN",
    "MUDRA_WORKING_CAPITAL",
    "TEMPORARY_OVERDRAFT",
    "FACTORING_WITHOUT_RECOURSE_BUYER",
    "OVERDRAFT_AGAINST_FD",
    "OVERDRAFT_AGAINST_SHARES_SECURITIES",
    "OVERDRAFT_AGAINST_COLLATERAL",
    "MERCHANT_ACQUIRING",
    "GOVERNMENT_SPONSORED_LOAN",
    "WORKING_CAPITAL_LOAN",
    "THREE_WHEELER_LOAN",
    "CREDIT_EXPOSURES_CONVERTED_TO_SECURITIES",
    "OTHERS",
]);

/** CIBIL "Account STATUS": 01 Open … 11 Purchase from Bank. */
export const cibilAccountStatusEnum = pgEnum("cibil_account_status", [
    "OPEN",
    "CLOSED_BY_PAYMENT",
    "SETTLED_AND_CLOSED",
    "RESTRUCTURED",
    "WRITTEN_OFF",
    "SETTLED_POST_WRITE_OFF",
    "INVOKED",
    "DEVOLVED",
    "RESTRUCTURED_DUE_TO_NATURAL_CALAMITY",
    "SOLD_TO_ARC",
    "PURCHASE_FROM_BANK",
]);

/** CIBIL "ACCOUNT CLASSIFICATION": 01 Standard … 05 Special Mention Account. */
export const assetClassificationEnum = pgEnum("asset_classification", [
    "STANDARD",
    "SUBSTANDARD",
    "DOUBTFUL",
    "LOSS",
    "SPECIAL_MENTION_ACCOUNT",
]);

/**
 * Union of the consumer sheet's "Payment Frequency" (9 values) and the
 * commercial sheet's "Repayment Frequency" (8 values); the sheets overlap but
 * neither list is a superset of the other.
 */
export const paymentFrequencyEnum = pgEnum("payment_frequency", [
    "DAILY",
    "WEEKLY",
    "FORTNIGHTLY",
    "MONTHLY",
    "QUARTERLY",
    "HALF_YEARLY",
    "YEARLY",
    "BULLET",
    "ON_DEMAND",
    "ROLLING",
    "OTHERS",
]);

/**
 * CIBIL "Type of Collateral": 00 No Collateral, 02 Gold, 03 Shares,
 * 04 Saving Account and Fixed Deposit, 05 Multiple Securities, 06 Others.
 * (The workbook skips code 01.)
 */
export const cibilCollateralTypeEnum = pgEnum("cibil_collateral_type", [
    "NO_COLLATERAL",
    "GOLD",
    "SHARES",
    "SAVINGS_ACCOUNT_AND_FIXED_DEPOSIT",
    "MULTIPLE_SECURITIES",
    "OTHERS",
]);

/* ============================================================
   INTEREST BASIS
============================================================ */

export const interestBasisEnum = pgEnum("interest_basis", [
    "ACTUAL_365",
    "ACTUAL_360",
    "THIRTY_360",
    "MONTHLY",
    "FIXED_MONTHLY",
    "FULL_MONTH",
    "CUSTOM",
    "MONTHLY_RATE_ACTUAL_30",
]);

/* ============================================================
   INTEREST CALCULATION METHOD
============================================================ */

export const calculationMethodEnum = pgEnum("calculation_method", [
    "RUNNING_BALANCE",
    "SIMPLE_INTEREST",
]);

/* ============================================================
   INTEREST RULE TYPE
============================================================ */

export const interestRuleTypeEnum = pgEnum("interest_rule_type", [
    "NORMAL",
    "STEP_UP",
    "STEP_DOWN",
    "EVENT_BASED",
    "CUSTOM",
]);

/* ============================================================
   PENAL INTEREST
============================================================ */

export const penalInterestTypeEnum = pgEnum("penal_interest_type", [
    "PERCENTAGE",
    "FIXED_AMOUNT",
]);

/* ============================================================
   PAYMENT STATUS
============================================================ */

export const paymentStatusEnum = pgEnum("payment_status", [
    "PENDING",
    "PARTIAL",
    "SUCCESS",
    "FAILED",
    "CANCELLED",
]);

/* ============================================================
   PAYMENT MODE
============================================================ */

export const paymentModeEnum = pgEnum("payment_mode", [
    "NEFT",
    "RTGS",
    "IMPS",
    "UPI",
    "CHEQUE",
    "CASH",
    "BANK_TRANSFER",
    "OTHER",
]);

/* ============================================================
   REPAYMENT TYPE
============================================================ */

export const repaymentTypeEnum = pgEnum("repayment_type", [
    "EMI",
    "BULLET",
    "INTEREST_ONLY",
    "STRUCTURED",
    "CUSTOM",
]);

/* ============================================================
   DOCUMENT TYPES
============================================================ */

export const documentTypeEnum = pgEnum("document_type", [
    "SANCTION_LETTER",
    "LOAN_AGREEMENT",
    "MORTGAGE_DEED",
    "HYPOTHECATION_DEED",
    "DPN",
    "BOARD_RESOLUTION",
    "PERSONAL_GUARANTEE",
    "CORPORATE_GUARANTEE",
    "LEGAL_OPINION",
    "VALUATION_REPORT",
    "INSURANCE",
    "KYC",
    "PAN_CARD",
    "GSTIN_CERTIFICATE",
    "AADHAAR",
    "FINANCIAL_STATEMENT",
    "OTHER",
]);

/* ============================================================
   DOCUMENT OWNER
============================================================ */

export const documentOwnerEnum = pgEnum("document_owner", [
    "BORROWER",
    "LOAN",
    "PROPERTY",
    "PROMOTER",
    "GUARANTOR",
]);

/* ============================================================
   REMINDER STATUS
============================================================ */

export const reminderStatusEnum = pgEnum("reminder_status", [
    "PENDING",
    "SENT",
    "FAILED",
]);

/* ============================================================
   REMINDER CHANNEL
============================================================ */

export const reminderChannelEnum = pgEnum("reminder_channel", [
    "EMAIL",
    "WHATSAPP",
    "SMS",
]);

/* ============================================================
   NOTIFICATION STATUS
============================================================ */

export const notificationStatusEnum = pgEnum("notification_status", [
    "SUCCESS",
    "FAILED",
]);

/* ============================================================
   COLLECTION STATUS
============================================================ */

export const collectionStatusEnum = pgEnum("collection_status", [
    "OPEN",
    "PROMISE_TO_PAY",
    "FOLLOW_UP",
    "CLOSED",
]);

/* ============================================================
   ACCOUNTING ENTRY TYPE
============================================================ */

export const accountingEntryTypeEnum = pgEnum("accounting_entry_type", [
    "DISBURSEMENT",
    "INTEREST_ACCRUAL",
    "INTEREST_RECEIPT",
    "PRINCIPAL_RECEIPT",
    "PENAL_INTEREST",
    "WRITE_OFF",
]);

/* ============================================================
   AUDIT ACTIONS
============================================================ */

export const auditActionEnum = pgEnum("audit_action", [
    "CREATE",
    "UPDATE",
    "DELETE",
    "LOGIN",
    "LOGOUT",
]);

/* ============================================================
   ENTITY STATUS
============================================================ */

export const entityStatusEnum = pgEnum("entity_status", [
    "ACTIVE",
    "INACTIVE",
]);

/* ============================================================
   COMMON MONEY COLUMN
============================================================ */

export const money = (name: string) =>
    numeric(name, {
        precision: 18,
        scale: 2,
    });

/* ============================================================
   COMMON TIMESTAMPS
============================================================ */

export const timestamps = {
    createdAt: timestamp("created_at", {
        withTimezone: true,
    }).defaultNow(),

    updatedAt: timestamp("updated_at", {
        withTimezone: true,
    }).defaultNow(),

    deletedAt: timestamp("deleted_at", {
        withTimezone: true,
    }),
};


/* ============================================================
   PENAL INTEREST BASE
============================================================ */

export const penalInterestBaseEnum = pgEnum("penal_interest_base", [
    "ENTIRE_OUTSTANDING",
    "OVERDUE_INSTALLMENT_ONLY",
]);


/* ============================================================
   PAYMENT WATERFALL BUCKET TYPE
============================================================ */

export const waterfallBucketTypeEnum = pgEnum("waterfall_bucket_type", [
    "PENALTY",
    "INTEREST",
    "PRINCIPAL",
    "SPECIFIC_TRANCHE",
]);