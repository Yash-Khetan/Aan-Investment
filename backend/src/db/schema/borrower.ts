import {
    pgTable,
    uuid,
    varchar,
    text,
    date,
    numeric,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import {
    addressCategoryEnum,
    applicantTypeEnum,
    borrowerTypeEnum,
    businessCategoryEnum,
    businessTypeEnum,
    constitutionEnum,
    entityStatusEnum,
    genderEnum,
    money,
    ownershipIndicatorEnum,
    relatedPersonRelationshipEnum,
    relatedPersonTypeEnum,
    residenceCodeEnum,
    timestamps,
} from "./shared";

import { users } from "./auth";

/* ============================================================
   BORROWERS
============================================================ */

export const borrowers = pgTable("borrowers", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    /**
     * Which CIBIL submission format this borrower is captured under.
     * Drives which set of fields the Add/Edit Borrower page collects and
     * which of them are mandatory.
     */
    borrowerType: borrowerTypeEnum("borrower_type")
        .notNull()
        .default("COMMERCIAL"),

    borrowerCode: varchar("borrower_code", {
        length: 50,
    }).notNull(),

    name: varchar("name", {
        length: 255,
    }).notNull(),

    groupName: varchar("group_name", {
        length: 255,
    }),

    constitution: constitutionEnum("constitution")
        .notNull(),

    /* ── Contact ── */

    email: varchar("email", {
        length: 255,
    }),

    phone: varchar("phone", {
        length: 20,
    }),

    alternatePhone: varchar("alternate_phone", {
        length: 20,
    }),

    /* ── Address ── */

    addressLine1: text("address_line_1"),

    addressLine2: text("address_line_2"),

    city: varchar("city", {
        length: 100,
    }),

    /** CIBIL commercial "District". */
    district: varchar("district", {
        length: 100,
    }),

    state: varchar("state", {
        length: 100,
    }),

    pincode: varchar("pincode", {
        length: 10,
    }),

    /* ── Identity ── */

    pan: varchar("pan", {
        length: 10,
    }),

    gst: varchar("gst", {
        length: 20,
    }),

    cin: varchar("cin", {
        length: 25,
    }),

    aadhaar: varchar("aadhaar", {
        length: 12,
    }),

    /* ── Business Details ── */

    dateOfIncorporation: date("date_of_incorporation"),

    natureOfBusiness: text("nature_of_business"),

    /* ── CIBIL Consumer (borrowerType = CONSUMER) ── */

    gender: genderEnum("gender"),

    dateOfBirth: date("date_of_birth"),

    addressCategory: addressCategoryEnum("address_category"),

    residenceCode: residenceCodeEnum("residence_code"),

    ownershipIndicator: ownershipIndicatorEnum("ownership_indicator"),

    /** CIBIL "CKYC No." — 14-digit Central KYC Registry identifier. */
    ckycNumber: varchar("ckyc_number", {
        length: 14,
    }),

    /* ── CIBIL Commercial (borrowerType = COMMERCIAL) ── */

    businessCategory: businessCategoryEnum("business_category"),

    businessType: businessTypeEnum("business_type"),

    /** CIBIL "Class of Activity 1" — 5-digit code from the handbook of instructions. */
    classOfActivity1: varchar("class_of_activity_1", {
        length: 5,
    }),

    /** CIBIL commercial "Borrower Type" column: Applicant / Co-Applicant. */
    applicantType: applicantTypeEnum("applicant_type"),

    /* ── Internal Rating ── */

    internalRating: varchar("internal_rating", {
        length: 10,
    }),

    ratingRemarks: text("rating_remarks"),

    /* ── Relationship Manager ── */

    relationshipManagerId: uuid("relationship_manager_id")
        .references(() => users.id),

    /* ── Status ── */

    status: entityStatusEnum("status")
        .default("ACTIVE"),

    notes: text("notes"),

    ...timestamps,

}, (table) => ({

    borrowerCodeIdx: uniqueIndex("borrower_code_idx")
        .on(table.borrowerCode),

    borrowerPanIdx: index("borrower_pan_idx")
        .on(table.pan),

    borrowerRmIdx: index("borrower_rm_idx")
        .on(table.relationshipManagerId),

    borrowerTypeIdx: index("borrower_type_idx")
        .on(table.borrowerType),

}));

/* ============================================================
   PROMOTERS
============================================================ */

export const promoters = pgTable("promoters", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    borrowerId: uuid("borrower_id")
        .references(() => borrowers.id, {
            onDelete: "cascade",
        })
        .notNull(),

    name: varchar("name", {
        length: 255,
    }).notNull(),

    designation: varchar("designation", {
        length: 150,
    }),

    /* ── CIBIL commercial "Related Person" attributes ── */

    gender: genderEnum("gender"),

    relatedPersonType: relatedPersonTypeEnum("related_person_type"),

    relationship: relatedPersonRelationshipEnum("relationship"),

    dateOfBirth: date("date_of_birth"),

    pan: varchar("pan", {
        length: 10,
    }),

    aadhar: varchar("aadhar", {
        length: 12,
    }),

    din: varchar("din", {
        length: 20,
    }),

    phone: varchar("phone", {
        length: 20,
    }),

    email: varchar("email", {
        length: 255,
    }),

    addressLine1: text("address_line_1"),

    city: varchar("city", {
        length: 100,
    }),

    /** CIBIL commercial "Related Person (District)". */
    district: varchar("district", {
        length: 100,
    }),

    state: varchar("state", {
        length: 100,
    }),

    pincode: varchar("pincode", {
        length: 10,
    }),

    shareholdingPercent: numeric("shareholding_percent", {
        precision: 5,
        scale: 2,
    }),

    ...timestamps,

}, (table) => ({

    promoterBorrowerIdx: index("promoter_borrower_idx")
        .on(table.borrowerId),

}));
