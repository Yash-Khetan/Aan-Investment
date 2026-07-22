import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Format patterns (India-specific identity documents)                */
/* ------------------------------------------------------------------ */

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
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
const email = z.string().trim().email("must be a valid email");
const mobile = z.string().trim().regex(MOBILE_RE, "must be a valid mobile number");
const pincode = z.string().trim().regex(PINCODE_RE, "must be a valid 6-digit pincode");

const netWorth = z.coerce
    .number()
    .finite("must be a finite number")
    .nonnegative("must be zero or positive");

/* ------------------------------------------------------------------ */
/* Create                                                             */
/* ------------------------------------------------------------------ */

export const createGuarantorSchema = z
    .object({
        name: z.string().trim().min(1, "is required").max(255),
        guaranteeType: z.string().trim().min(1, "is required").max(50),
        pan: pan.optional(),
        phone: mobile.optional(),
        email: email.optional(),
        addressLine1: z.string().trim().optional(),
        city: z.string().trim().max(100).optional(),
        state: z.string().trim().max(100).optional(),
        pincode: pincode.optional(),
        netWorth: netWorth.optional(),
    })
    .strict();

/* ------------------------------------------------------------------ */
/* Update (partial; every field nullable so a client can clear one)   */
/* ------------------------------------------------------------------ */

export const updateGuarantorSchema = z
    .object({
        name: z.string().trim().min(1).max(255),
        guaranteeType: z.string().trim().min(1).max(50),
        pan: pan.nullable(),
        phone: mobile.nullable(),
        email: email.nullable(),
        addressLine1: z.string().trim().nullable(),
        city: z.string().trim().max(100).nullable(),
        state: z.string().trim().max(100).nullable(),
        pincode: pincode.nullable(),
        netWorth: netWorth.nullable(),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided",
    });

/* ------------------------------------------------------------------ */
/* Params                                                              */
/* ------------------------------------------------------------------ */

export const loanIdParamSchema = z.object({
    loanId: uuid,
});

export const guarantorIdParamSchema = z.object({
    loanId: uuid,
    id: uuid,
});
