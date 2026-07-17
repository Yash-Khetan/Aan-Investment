import { z } from "zod";

import {
    loanTypeEnum,
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
 * Interest rate is stored as loan master data only. The Loan module records and
 * exposes it but performs NO interest logic (accrual, penal, step rules, EMI) —
 * all interest behaviour is owned by the Interest Engine (Developer B). Hence
 * only a basic non-negative storage/integrity check here, no rate policy/caps.
 */
const interestRate = z.coerce
    .number({ error: "must be a number" })
    .nonnegative("must be zero or positive");

/** Calendar date string in YYYY-MM-DD form. */
const dateString = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a valid date (YYYY-MM-DD)")
    .refine((v) => !Number.isNaN(Date.parse(v)), "must be a valid calendar date");

const uuid = z.string().uuid("must be a valid UUID");

const loanTypeSchema = z.enum(loanTypeEnum.enumValues);
const securityTypeSchema = z.enum(securityTypeEnum.enumValues);
const repaymentTypeSchema = z.enum(repaymentTypeEnum.enumValues);
const loanStatusSchema = z.enum(loanStatusEnum.enumValues);

/* ------------------------------------------------------------------ */
/* Cross-field business rules                                          */
/* ------------------------------------------------------------------ */

/**
 * Validates monetary and date invariants against an already-merged view of the
 * loan (used for both create and update, where update merges with the existing
 * record before checking).
 */
export const assertLoanInvariants = (
    data: {
        sanctionedAmount?: number;
        disbursedAmount?: number;
        outstandingPrincipal?: number;
        sanctionDate?: string | null;
        firstDisbursementDate?: string | null;
        maturityDate?: string | null;
    },
    ctx: z.RefinementCtx,
): void => {
    const {
        sanctionedAmount,
        disbursedAmount,
        outstandingPrincipal,
        sanctionDate,
        firstDisbursementDate,
        maturityDate,
    } = data;

    if (
        sanctionedAmount !== undefined &&
        disbursedAmount !== undefined &&
        disbursedAmount > sanctionedAmount
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["disbursedAmount"],
            message: "disbursedAmount cannot exceed sanctionedAmount",
        });
    }

    if (
        sanctionedAmount !== undefined &&
        outstandingPrincipal !== undefined &&
        outstandingPrincipal > sanctionedAmount
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["outstandingPrincipal"],
            message: "outstandingPrincipal cannot exceed sanctionedAmount",
        });
    }

    if (
        firstDisbursementDate &&
        maturityDate &&
        Date.parse(maturityDate) <= Date.parse(firstDisbursementDate)
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["maturityDate"],
            message: "maturityDate must be after firstDisbursementDate",
        });
    }

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

    if (
        sanctionDate &&
        firstDisbursementDate &&
        Date.parse(firstDisbursementDate) < Date.parse(sanctionDate)
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["firstDisbursementDate"],
            message: "firstDisbursementDate cannot be before sanctionDate",
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
        repaymentType: repaymentTypeSchema,

        sanctionedAmount: money({ allowZero: false }),
        disbursedAmount: money({ allowZero: true }).optional(),
        outstandingPrincipal: money({ allowZero: true }).optional(),

        interestRate,
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
        firstDisbursementDate: dateString.optional(),
        maturityDate: dateString.optional(),

        purpose: z.string().trim().optional(),
        approvalNotes: z.string().trim().optional(),
        remarks: z.string().trim().optional(),

        status: loanStatusSchema.optional(),
        // Nullable so clients may send `null` to mean "no manager / not set".
        relationshipManagerId: uuid.nullable().optional(),
        createdBy: uuid.nullable().optional(),
    })
    .strict()
    .superRefine((data, ctx) => assertLoanInvariants(data, ctx));

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
        repaymentType: repaymentTypeSchema,
        sanctionedAmount: money({ allowZero: false }),
        disbursedAmount: money({ allowZero: true }),
        outstandingPrincipal: money({ allowZero: true }),
        interestRate,
        tenureMonths: z.coerce.number().int().positive(),
        moratoriumMonths: z.coerce.number().int().nonnegative(),
        sanctionDate: dateString.nullable(),
        firstDisbursementDate: dateString.nullable(),
        maturityDate: dateString.nullable(),
        purpose: z.string().trim().nullable(),
        approvalNotes: z.string().trim().nullable(),
        remarks: z.string().trim().nullable(),
        status: loanStatusSchema,
        relationshipManagerId: uuid.nullable(),
    })
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided",
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
