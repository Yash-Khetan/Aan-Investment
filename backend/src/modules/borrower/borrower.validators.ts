import { z } from "zod";

import {
    addressCategoryEnum,
    applicantTypeEnum,
    borrowerTypeEnum,
    businessCategoryEnum,
    businessTypeEnum,
    constitutionEnum,
    entityStatusEnum,
    genderEnum,
    ownershipIndicatorEnum,
    relatedPersonRelationshipEnum,
    relatedPersonTypeEnum,
    residenceCodeEnum,
} from "../../db/schema";
import {
    DEFAULT_LIMIT,
    DEFAULT_PAGE,
    DEFAULT_SORT_BY,
    DEFAULT_SORT_ORDER,
    MAX_LIMIT,
    SORTABLE_COLUMNS,
} from "./borrower.constants";

/* ------------------------------------------------------------------ */
/* Format patterns (India-specific identity documents)                */
/* ------------------------------------------------------------------ */

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
const AADHAAR_RE = /^[0-9]{12}$/;
const MOBILE_RE = /^(\+91[- ]?)?[6-9][0-9]{9}$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;
/** CIBIL "CKYC No." — the Central KYC Registry issues 14-digit identifiers. */
const CKYC_RE = /^[0-9]{14}$/;
/** CIBIL "Class of Activity 1" — 5-digit code from the handbook of instructions. */
const CLASS_OF_ACTIVITY_RE = /^[0-9]{5}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const uuid = z.string().uuid("must be a valid UUID");

/** Uppercased-and-trimmed coded identifier validated against a pattern. */
const codedId = (re: RegExp, msg: string) =>
    z.preprocess(
        (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
        z.string().regex(re, msg),
    );

const pan = codedId(PAN_RE, "must be a valid PAN (AAAAA9999A)");
const gst = codedId(GST_RE, "must be a valid GSTIN");
const cin = codedId(CIN_RE, "must be a valid CIN");
const aadhaar = z.string().trim().regex(AADHAAR_RE, "must be 12 digits");
const email = z.string().trim().email("must be a valid email");
const mobile = z.string().trim().regex(MOBILE_RE, "must be a valid mobile number");
const pincode = z.string().trim().regex(PINCODE_RE, "must be a valid 6-digit pincode");
const ckycNumber = z.string().trim().regex(CKYC_RE, "must be 14 digits");
const classOfActivity = z
    .string()
    .trim()
    .regex(CLASS_OF_ACTIVITY_RE, "must be a 5-digit class-of-activity code");
const isoDate = z.string().regex(ISO_DATE_RE, "must be YYYY-MM-DD");

/**
 * Today in the server's local timezone as YYYY-MM-DD.
 *
 * Deliberately local rather than `toISOString()`: the deployment and its users
 * are both in IST (UTC+5:30), so between midnight and 05:30 IST the UTC date is
 * still yesterday — using UTC would reject a date the user correctly sees as
 * today. ISO dates compare correctly as plain strings.
 */
const todayLocalIso = (): string => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** An ISO date that must not be later than today. */
const pastOrToday = (label: string) =>
    isoDate.refine((value) => value <= todayLocalIso(), {
        message: `${label} cannot be in the future`,
    });

const dateOfBirth = pastOrToday("date of birth");
const dateOfIncorporation = pastOrToday("date of incorporation");

const constitutionSchema = z.enum(constitutionEnum.enumValues);
const statusSchema = z.enum(entityStatusEnum.enumValues);

/* CIBIL borrower-type discriminator and its per-format coded fields. */
const borrowerTypeSchema = z.enum(borrowerTypeEnum.enumValues);
const genderSchema = z.enum(genderEnum.enumValues);
const addressCategorySchema = z.enum(addressCategoryEnum.enumValues);
const residenceCodeSchema = z.enum(residenceCodeEnum.enumValues);
const ownershipIndicatorSchema = z.enum(ownershipIndicatorEnum.enumValues);
const businessCategorySchema = z.enum(businessCategoryEnum.enumValues);
const businessTypeSchema = z.enum(businessTypeEnum.enumValues);
const applicantTypeSchema = z.enum(applicantTypeEnum.enumValues);
const relatedPersonTypeSchema = z.enum(relatedPersonTypeEnum.enumValues);
const relatedPersonRelationshipSchema = z.enum(
    relatedPersonRelationshipEnum.enumValues,
);

const shareholdingPercent = z.coerce
    .number()
    .min(0, "must be zero or positive")
    .max(100, "must not exceed 100");

/* ------------------------------------------------------------------ */
/* Child entities (reuse existing promoters table)                    */
/* ------------------------------------------------------------------ */

export const promoterSchema = z
    .object({
        name: z.string().trim().min(1, "is required").max(255),
        designation: z.string().trim().max(150).optional(),
        /* CIBIL commercial "Related Person" attributes */
        gender: genderSchema.optional(),
        relatedPersonType: relatedPersonTypeSchema.optional(),
        relationship: relatedPersonRelationshipSchema.optional(),
        dateOfBirth: dateOfBirth.optional(),
        pan: pan.optional(),
        aadhar: aadhaar.optional(),
        din: z.string().trim().max(20).optional(),
        phone: mobile.optional(),
        email: email.optional(),
        addressLine1: z.string().trim().optional(),
        city: z.string().trim().max(100).optional(),
        district: z.string().trim().max(100).optional(),
        state: z.string().trim().max(100).optional(),
        pincode: pincode.optional(),
        shareholdingPercent: shareholdingPercent.optional(),
    })
    .strict();

/**
 * Partial update of one related person. Every field is optional; the nullable
 * ones clear the stored value when explicitly sent as null. `name` is the only
 * field that cannot be cleared, so it is optional-but-not-nullable.
 */
export const updatePromoterSchema = z
    .object({
        name: z.string().trim().min(1, "is required").max(255),
        designation: z.string().trim().max(150).nullable(),
        gender: genderSchema.nullable(),
        relatedPersonType: relatedPersonTypeSchema.nullable(),
        relationship: relatedPersonRelationshipSchema.nullable(),
        dateOfBirth: dateOfBirth.nullable(),
        pan: pan.nullable(),
        aadhar: aadhaar.nullable(),
        din: z.string().trim().max(20).nullable(),
        phone: mobile.nullable(),
        email: email.nullable(),
        addressLine1: z.string().trim().nullable(),
        city: z.string().trim().max(100).nullable(),
        district: z.string().trim().max(100).nullable(),
        state: z.string().trim().max(100).nullable(),
        pincode: pincode.nullable(),
        shareholdingPercent: shareholdingPercent.nullable(),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided",
    });

/** `:borrowerId` from the parent mount. */
export const promoterBorrowerIdParamSchema = z.object({
    borrowerId: uuid,
});

/** `:borrowerId` from the parent mount plus this router's own `:id`. */
export const promoterIdParamSchema = z.object({
    borrowerId: uuid,
    id: uuid,
});

/* ------------------------------------------------------------------ */
/* Borrower-type field partitioning                                   */
/*                                                                     */
/* Mirrors the two sheets of the client's CIBIL workbook. Fields the   */
/* two formats share (borrower code, name, state, pincode, …) are      */
/* listed under neither; only format-specific ones appear here.        */
/* ------------------------------------------------------------------ */

/** Consumer-sheet columns that carry no "(If available)" qualifier. */
const CONSUMER_REQUIRED_FIELDS = [
    "gender",
    "dateOfBirth",
    "pan", // Consumer sheet: "Income Tax ID Number"
    "phone",
    "email",
    "addressLine1",
    "state",
    "pincode",
    "addressCategory",
    "residenceCode",
    "ownershipIndicator",
] as const;

/** Commercial-sheet columns that carry no "(If available)" qualifier. */
const COMMERCIAL_REQUIRED_FIELDS = [
    "pan",
    "dateOfIncorporation",
    "constitution",
    "businessCategory",
    "businessType",
    "classOfActivity1",
    "addressLine1",
    "city",
    "district",
    "state",
    "pincode",
    "email",
    "phone",
    "applicantType",
] as const;

/** Fields that exist only on the consumer sheet. */
const CONSUMER_ONLY_FIELDS = [
    "gender",
    "dateOfBirth",
    "addressCategory",
    "residenceCode",
    "ownershipIndicator",
    "ckycNumber",
] as const;

/** Fields that exist only on the commercial sheet. */
const COMMERCIAL_ONLY_FIELDS = [
    "businessCategory",
    "businessType",
    "classOfActivity1",
    "district",
    "applicantType",
] as const;

type BorrowerType = (typeof borrowerTypeEnum.enumValues)[number];

const requiredFieldsFor = (type: BorrowerType): readonly string[] =>
    type === "CONSUMER" ? CONSUMER_REQUIRED_FIELDS : COMMERCIAL_REQUIRED_FIELDS;

const foreignFieldsFor = (type: BorrowerType): readonly string[] =>
    type === "CONSUMER" ? COMMERCIAL_ONLY_FIELDS : CONSUMER_ONLY_FIELDS;

const isBlank = (value: unknown): boolean =>
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "");

/**
 * Enforce the selected borrower type's field rules:
 *  - every field the type's CIBIL sheet marks mandatory must be present, and
 *  - fields belonging exclusively to the *other* type must be left empty.
 *
 * `onlyPresentKeys` restricts the mandatory check to keys the payload actually
 * carries, so a partial update is not forced to resend the whole record.
 */
const refineByBorrowerType = (
    data: Record<string, unknown>,
    ctx: z.RefinementCtx,
    borrowerType: BorrowerType,
    onlyPresentKeys: boolean,
): void => {
    for (const field of requiredFieldsFor(borrowerType)) {
        if (onlyPresentKeys && !(field in data)) continue;
        if (isBlank(data[field])) {
            ctx.addIssue({
                code: "custom",
                path: [field],
                message: `is required for ${borrowerType} borrowers`,
            });
        }
    }

    for (const field of foreignFieldsFor(borrowerType)) {
        if (!isBlank(data[field])) {
            ctx.addIssue({
                code: "custom",
                path: [field],
                message: `is not applicable to ${borrowerType} borrowers`,
            });
        }
    }
};

/* ------------------------------------------------------------------ */
/* Create                                                             */
/* ------------------------------------------------------------------ */

export const createBorrowerSchema = z
    .object({
        /** Selects which CIBIL sheet's field rules apply. */
        borrowerType: borrowerTypeSchema,

        borrowerCode: z.string().trim().min(1, "is required").max(50),
        name: z.string().trim().min(1, "is required").max(255),
        groupName: z.string().trim().max(255).optional(),
        constitution: constitutionSchema,

        /* Contact */
        email: email.optional(),
        phone: mobile.optional(),
        alternatePhone: mobile.optional(),

        /* Registered address */
        addressLine1: z.string().trim().optional(),
        addressLine2: z.string().trim().optional(),
        city: z.string().trim().max(100).optional(),
        district: z.string().trim().max(100).optional(),
        state: z.string().trim().max(100).optional(),
        pincode: pincode.optional(),

        /* Identity */
        pan: pan.optional(),
        gst: gst.optional(),
        cin: cin.optional(),
        aadhaar: aadhaar.optional(),

        /* Business */
        dateOfIncorporation: dateOfIncorporation.optional(),
        natureOfBusiness: z.string().trim().optional(), // SRS "Industry"

        /* CIBIL consumer */
        gender: genderSchema.optional(),
        dateOfBirth: dateOfBirth.optional(),
        addressCategory: addressCategorySchema.optional(),
        residenceCode: residenceCodeSchema.optional(),
        ownershipIndicator: ownershipIndicatorSchema.optional(),
        ckycNumber: ckycNumber.optional(),

        /* CIBIL commercial */
        businessCategory: businessCategorySchema.optional(),
        businessType: businessTypeSchema.optional(),
        classOfActivity1: classOfActivity.optional(),
        applicantType: applicantTypeSchema.optional(),

        /* Internal */
        internalRating: z.string().trim().max(10).optional(),
        ratingRemarks: z.string().trim().optional(),
        relationshipManagerId: uuid.nullable().optional(),
        status: statusSchema.optional(),
        notes: z.string().trim().optional(), // SRS "Remarks"

        /* Child entities (optional; inserted transactionally) */
        promoters: z.array(promoterSchema).optional(),
    })
    .strict()
    .superRefine((data, ctx) => {
        refineByBorrowerType(data, ctx, data.borrowerType, false);

        // "Related Person" is a commercial-sheet block only.
        if (data.borrowerType === "CONSUMER" && (data.promoters?.length ?? 0) > 0) {
            ctx.addIssue({
                code: "custom",
                path: ["promoters"],
                message: "is not applicable to CONSUMER borrowers",
            });
        }
    });

/* ------------------------------------------------------------------ */
/* Update (partial master fields; child entities managed separately)  */
/* ------------------------------------------------------------------ */

export const updateBorrowerSchema = z
    .object({
        borrowerType: borrowerTypeSchema,
        borrowerCode: z.string().trim().min(1).max(50),
        name: z.string().trim().min(1).max(255),
        groupName: z.string().trim().max(255).nullable(),
        constitution: constitutionSchema,
        email: email.nullable(),
        phone: mobile.nullable(),
        alternatePhone: mobile.nullable(),
        addressLine1: z.string().trim().nullable(),
        addressLine2: z.string().trim().nullable(),
        city: z.string().trim().max(100).nullable(),
        district: z.string().trim().max(100).nullable(),
        state: z.string().trim().max(100).nullable(),
        pincode: pincode.nullable(),
        pan: pan.nullable(),
        gst: gst.nullable(),
        cin: cin.nullable(),
        aadhaar: aadhaar.nullable(),
        dateOfIncorporation: dateOfIncorporation.nullable(),
        natureOfBusiness: z.string().trim().nullable(),

        /* CIBIL consumer */
        gender: genderSchema.nullable(),
        dateOfBirth: dateOfBirth.nullable(),
        addressCategory: addressCategorySchema.nullable(),
        residenceCode: residenceCodeSchema.nullable(),
        ownershipIndicator: ownershipIndicatorSchema.nullable(),
        ckycNumber: ckycNumber.nullable(),

        /* CIBIL commercial */
        businessCategory: businessCategorySchema.nullable(),
        businessType: businessTypeSchema.nullable(),
        classOfActivity1: classOfActivity.nullable(),
        applicantType: applicantTypeSchema.nullable(),

        internalRating: z.string().trim().max(10).nullable(),
        ratingRemarks: z.string().trim().nullable(),
        relationshipManagerId: uuid.nullable(),
        status: statusSchema,
        notes: z.string().trim().nullable(),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided",
    })
    .superRefine((data, ctx) => {
        // Type-specific rules only apply once the payload states which type it
        // is being saved as; a patch that omits borrowerType stays untouched.
        if (data.borrowerType === undefined) return;
        refineByBorrowerType(data, ctx, data.borrowerType, true);
    });

/* ------------------------------------------------------------------ */
/* Query (list): pagination, sorting, filtering, search               */
/* ------------------------------------------------------------------ */

export const listBorrowersQuerySchema = z
    .object({
        page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
        limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
        sortBy: z
            .enum(
                Object.keys(SORTABLE_COLUMNS) as [
                    keyof typeof SORTABLE_COLUMNS,
                    ...(keyof typeof SORTABLE_COLUMNS)[],
                ],
            )
            .default(DEFAULT_SORT_BY),
        sortOrder: z.enum(["asc", "desc"]).default(DEFAULT_SORT_ORDER),

        search: z.string().trim().min(1).optional(),

        status: statusSchema.optional(),
        borrowerType: borrowerTypeSchema.optional(),
        constitution: constitutionSchema.optional(),
        relationshipManagerId: uuid.optional(),
    })
    .strict();

export const borrowerIdParamSchema = z.object({
    id: uuid,
});
