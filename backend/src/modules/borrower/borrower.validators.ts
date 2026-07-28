import { z } from "zod";

import { constitutionEnum, entityStatusEnum } from "../../db/schema";
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

const constitutionSchema = z.enum(constitutionEnum.enumValues);
const statusSchema = z.enum(entityStatusEnum.enumValues);

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
        pan: pan.optional(),
        aadhar: aadhaar.optional(),
        din: z.string().trim().max(20).optional(),
        phone: mobile.optional(),
        email: email.optional(),
        addressLine1: z.string().trim().optional(),
        city: z.string().trim().max(100).optional(),
        state: z.string().trim().max(100).optional(),
        pincode: pincode.optional(),
        shareholdingPercent: shareholdingPercent.optional(),
    })
    .strict();

/* ------------------------------------------------------------------ */
/* Create                                                             */
/* ------------------------------------------------------------------ */

export const createBorrowerSchema = z
    .object({
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
        state: z.string().trim().max(100).optional(),
        pincode: pincode.optional(),

        /* Identity */
        pan: pan.optional(),
        gst: gst.optional(),
        cin: cin.optional(),
        aadhaar: aadhaar.optional(),

        /* Business */
        dateOfIncorporation: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
            .optional(),
        natureOfBusiness: z.string().trim().optional(), // SRS "Industry"

        /* Internal */
        internalRating: z.string().trim().max(10).optional(),
        ratingRemarks: z.string().trim().optional(),
        relationshipManagerId: uuid.nullable().optional(),
        status: statusSchema.optional(),
        notes: z.string().trim().optional(), // SRS "Remarks"

        /* Child entities (optional; inserted transactionally) */
        promoters: z.array(promoterSchema).optional(),
    })
    .strict();

/* ------------------------------------------------------------------ */
/* Update (partial master fields; child entities managed separately)  */
/* ------------------------------------------------------------------ */

export const updateBorrowerSchema = z
    .object({
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
        state: z.string().trim().max(100).nullable(),
        pincode: pincode.nullable(),
        pan: pan.nullable(),
        gst: gst.nullable(),
        cin: cin.nullable(),
        aadhaar: aadhaar.nullable(),
        dateOfIncorporation: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
            .nullable(),
        natureOfBusiness: z.string().trim().nullable(),
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
        constitution: constitutionSchema.optional(),
        relationshipManagerId: uuid.optional(),
    })
    .strict();

export const borrowerIdParamSchema = z.object({
    id: uuid,
});
