import { z } from "zod";

import {
    assetClassificationEnum,
    cibilAccountStatusEnum,
    cibilCollateralTypeEnum,
    cibilCreditTypeEnum,
    interestBasisEnum,
    loanTypeEnum,
    paymentFrequencyEnum,
    securityTypeEnum,
    repaymentTypeEnum,
    loanStatusEnum,
} from "../../db/schema";
import {
    DEFAULT_LIMIT,
    DEFAULT_PAGE,
    DEFAULT_SORT_BY,
    DEFAULT_SORT_ORDER,
    MAX_LIMIT,
    SORTABLE_COLUMNS,
} from "./loan.constants";

/* ------------------------------------------------------------------ */
/* Reusable field schemas                                              */
/* ------------------------------------------------------------------ */

/** Monetary value: finite number with at most 2 decimal places. */
const money = (opts: { allowZero: boolean }) => {
    const base = z.coerce
        .number({ error: "must be a number" })
        .finite("must be a finite number");
    const bounded = opts.allowZero
        ? base.nonnegative("must be zero or positive")
        : base.positive("must be greater than zero");
    return bounded.refine(
        (n) => Math.round(n * 100) === n * 100,
        "must have at most 2 decimal places",
    );
};

/**
 * Annual interest rate. Edited on the loan, but stored only as an
 * effective-dated interest_configs revision — never on the loan row — which
 * the ledger accrues at. Hence only a basic non-negative check here.
 */
const interestRate = z.coerce
    .number({ error: "must be a number" })
    .nonnegative("must be zero or positive");

/** TDS withheld as a percentage of accrued interest. Stored with the rate, in interest_configs. */
const tdsRatePercent = z.coerce
    .number({ error: "must be a number" })
    .min(0, "must be zero or positive")
    .max(100, "cannot exceed 100");

/** Calendar date string in YYYY-MM-DD form. */
const dateString = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a valid date (YYYY-MM-DD)")
    .refine((v) => !Number.isNaN(Date.parse(v)), "must be a valid calendar date");

const uuid = z.string().uuid("must be a valid UUID");

/* ------------------------------------------------------------------ */
/* Interest configuration                                              */
/*                                                                     */
/* These are the Interest module's own values, editable from the Loan  */
/* module because the loan is the source of the current configuration. */
/* They are NOT columns on the loans table: saving a loan writes them  */
/* as an effective-dated interest_configs revision. Every option here  */
/* comes from the existing enums the calculation engine already reads. */
/* ------------------------------------------------------------------ */

const interestBasisSchema = z.enum(interestBasisEnum.enumValues);

const loanTypeSchema = z.enum(loanTypeEnum.enumValues);
const securityTypeSchema = z.enum(securityTypeEnum.enumValues);
const repaymentTypeSchema = z.enum(repaymentTypeEnum.enumValues);
const loanStatusSchema = z.enum(loanStatusEnum.enumValues);

/* CIBIL reporting code lists — see the loans schema for why these sit
   alongside, rather than replace, the operational enums above. */
const creditTypeSchema = z.enum(cibilCreditTypeEnum.enumValues);
const cibilAccountStatusSchema = z.enum(cibilAccountStatusEnum.enumValues);
const assetClassificationSchema = z.enum(assetClassificationEnum.enumValues);
const paymentFrequencySchema = z.enum(paymentFrequencyEnum.enumValues);
const cibilCollateralTypeSchema = z.enum(cibilCollateralTypeEnum.enumValues);

/* ------------------------------------------------------------------ */
/* Cross-field business rules                                          */
/* ------------------------------------------------------------------ */

/**
 * Date invariants, checked against an already-merged view of the loan (used
 * for both create and update, where update merges with the existing record
 * before checking). Amounts disbursed and outstanding are not checked here:
 * they are not loan fields but ledger figures.
 */
export const assertLoanInvariants = (
    data: {
        sanctionDate?: string | null;
        maturityDate?: string | null;
    },
    ctx: z.RefinementCtx,
): void => {
    const { sanctionDate, maturityDate } = data;

    if (
        sanctionDate &&
        maturityDate &&
        Date.parse(maturityDate) <= Date.parse(sanctionDate)
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["maturityDate"],
            message: "maturityDate must be after sanctionDate",
        });
    }
};

/**
 * CIBIL pairs "Type of Collateral" with "Value of Collateral", both qualified
 * "(If secured loan)". Keep the two consistent: a value needs a type to explain
 * it, and declaring NO_COLLATERAL contradicts carrying a value.
 */
export const assertCollateralPair = (
    data: { collateralType?: string | null; collateralValue?: number | null },
    ctx: z.RefinementCtx,
): void => {
    const hasValue =
        data.collateralValue !== undefined &&
        data.collateralValue !== null &&
        data.collateralValue > 0;

    if (hasValue && !data.collateralType) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["collateralType"],
            message: "collateralType is required when collateralValue is provided",
        });
    }

    if (data.collateralType === "NO_COLLATERAL" && hasValue) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["collateralValue"],
            message: "collateralValue must be zero or omitted when collateralType is NO_COLLATERAL",
        });
    }
};

/** securityType "OTHERS" requires a free-text label; every other value must leave it unset. */
export const assertOtherSecurityType = (
    data: { securityType?: string | null; otherSecurityType?: string | null },
    ctx: z.RefinementCtx,
): void => {
    if (data.securityType === "OTHERS" && !data.otherSecurityType?.trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["otherSecurityType"],
            message: "otherSecurityType is required when securityType is OTHERS",
        });
    }

    if (data.securityType !== "OTHERS" && data.otherSecurityType) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["otherSecurityType"],
            message: "otherSecurityType may only be set when securityType is OTHERS",
        });
    }
};

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export const createLoanSchema = z
    .object({
        loanAccountNumber: z
            .string()
            .trim()
            .min(1, "is required")
            .max(50, "must be at most 50 characters"),
        borrowerId: uuid,
        loanType: loanTypeSchema,
        securityType: securityTypeSchema.optional(),
        otherSecurityType: z.string().trim().max(255).optional(),
        repaymentType: repaymentTypeSchema,

        sanctionedAmount: money({ allowZero: false }),

        /* Interest configuration — persisted as an interest_configs revision. */
        interestRate,
        tdsRatePercent: tdsRatePercent.optional(),
        interestBasis: interestBasisSchema.optional(),
        includeOpeningClosingDays: z.boolean().optional(),
        /** The date the configuration takes effect from. Defaults to the sanction date. */
        interestEffectiveFrom: dateString.optional(),

        tenureMonths: z.coerce
            .number()
            .int("must be an integer")
            .positive("must be greater than zero"),
        moratoriumMonths: z.coerce
            .number()
            .int("must be an integer")
            .nonnegative("must be zero or positive")
            .optional(),

        sanctionDate: dateString.optional(),
        maturityDate: dateString.optional(),

        purpose: z.string().trim().optional(),
        approvalNotes: z.string().trim().optional(),
        remarks: z.string().trim().optional(),

        status: loanStatusSchema.optional(),

        /* CIBIL reporting fields */
        creditType: creditTypeSchema.optional(),
        cibilAccountStatus: cibilAccountStatusSchema.optional(),
        assetClassification: assetClassificationSchema.optional(),
        paymentFrequency: paymentFrequencySchema.optional(),
        emiAmount: money({ allowZero: true }).optional(),
        collateralType: cibilCollateralTypeSchema.optional(),
        collateralValue: money({ allowZero: true }).optional(),

        // Nullable so clients may send `null` to mean "no manager / not set".
        relationshipManagerId: uuid.nullable().optional(),
        createdBy: uuid.nullable().optional(),
    })
    .strict()
    .superRefine((data, ctx) => {
        assertLoanInvariants(data, ctx);
        assertOtherSecurityType(data, ctx);
        assertCollateralPair(data, ctx);
    });

/* ------------------------------------------------------------------ */
/* Update (partial; cross-field rules re-checked in the service after  */
/* merging with the persisted record)                                  */
/* ------------------------------------------------------------------ */

export const updateLoanSchema = z
    .object({
        loanAccountNumber: z
            .string()
            .trim()
            .min(1, "is required")
            .max(50, "must be at most 50 characters"),
        borrowerId: uuid,
        loanType: loanTypeSchema,
        securityType: securityTypeSchema,
        otherSecurityType: z.string().trim().max(255).nullable(),
        repaymentType: repaymentTypeSchema,
        sanctionedAmount: money({ allowZero: false }),

        /* Interest configuration — persisted as an interest_configs revision. */
        interestRate,
        tdsRatePercent,
        interestBasis: interestBasisSchema,
        includeOpeningClosingDays: z.boolean(),
        interestEffectiveFrom: dateString,

        tenureMonths: z.coerce.number().int().positive(),
        moratoriumMonths: z.coerce.number().int().nonnegative(),
        sanctionDate: dateString.nullable(),
        maturityDate: dateString.nullable(),
        purpose: z.string().trim().nullable(),
        approvalNotes: z.string().trim().nullable(),
        remarks: z.string().trim().nullable(),
        status: loanStatusSchema,

        /* CIBIL reporting fields */
        creditType: creditTypeSchema.nullable(),
        cibilAccountStatus: cibilAccountStatusSchema.nullable(),
        assetClassification: assetClassificationSchema.nullable(),
        paymentFrequency: paymentFrequencySchema.nullable(),
        emiAmount: money({ allowZero: true }).nullable(),
        collateralType: cibilCollateralTypeSchema.nullable(),
        collateralValue: money({ allowZero: true }).nullable(),

        relationshipManagerId: uuid.nullable(),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided",
    })
    .superRefine((data, ctx) => {
        // Only checkable when the payload carries both halves of the pair; a
        // patch touching just one is reconciled against the stored row in the
        // service, matching how the other cross-field rules are handled here.
        if ("collateralType" in data && "collateralValue" in data) {
            assertCollateralPair(data, ctx);
        }
    });

/* ------------------------------------------------------------------ */
/* Query (list): pagination, sorting, filtering, search                */
/* ------------------------------------------------------------------ */

export const listLoansQuerySchema = z
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

        status: loanStatusSchema.optional(),
        loanType: loanTypeSchema.optional(),
        securityType: securityTypeSchema.optional(),
        borrowerId: uuid.optional(),
        relationshipManagerId: uuid.optional(),

        minSanctionedAmount: money({ allowZero: true }).optional(),
        maxSanctionedAmount: money({ allowZero: true }).optional(),

        sanctionDateFrom: dateString.optional(),
        sanctionDateTo: dateString.optional(),
    })
    .strict();

export const loanIdParamSchema = z.object({
    id: uuid,
});
