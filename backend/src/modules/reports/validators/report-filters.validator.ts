import { z } from "zod";

import {
    loanStatusEnum,
    securityTypeEnum,
    collectionStatusEnum,
} from "../../../db/schema";

import { MAX_DATE_RANGE_DAYS } from "../constants/report.constants";
import { EXPORT_FORMATS } from "../types/report.types";

const DAY_MS = 24 * 60 * 60 * 1000;

interface CommonFilterFields {
    branchId?: string;
    startDate?: string;
    endDate?: string;
}

/**
 * `branchId` is part of the module's public filter contract, but no
 * `branches` table exists in the current schema. Rather than silently
 * ignoring it (which would look like a bug to a caller), it is accepted
 * by the parser only so it can be rejected with a clear 400 here.
 */
function checkCommonRules(data: CommonFilterFields, ctx: z.RefinementCtx): void {
    if (data.branchId !== undefined) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["branchId"],
            message:
                "branchId filtering is not supported: no branches table exists in the current schema.",
        });
    }

    if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);

        if (start.getTime() > end.getTime()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["endDate"],
                message: "endDate must be on or after startDate.",
            });
            return;
        }

        const rangeDays = (end.getTime() - start.getTime()) / DAY_MS;

        if (rangeDays > MAX_DATE_RANGE_DAYS) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["endDate"],
                message: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days.`,
            });
        }
    }
}

const baseFiltersShape = {
    branchId: z.string().optional(),
    loanStatus: z.enum(loanStatusEnum.enumValues).optional(),
    customerId: z.string().uuid("customerId must be a valid UUID").optional(),
    startDate: z.string().date("startDate must be an ISO date (YYYY-MM-DD)").optional(),
    endDate: z.string().date("endDate must be an ISO date (YYYY-MM-DD)").optional(),
    collateralType: z.enum(securityTypeEnum.enumValues).optional(),
    collectionStatus: z.enum(collectionStatusEnum.enumValues).optional(),
};

export const reportFiltersSchema = z
    .object(baseFiltersShape)
    .strict()
    .superRefine(checkCommonRules);

export const exportQuerySchema = z
    .object({
        ...baseFiltersShape,
        format: z.enum(EXPORT_FORMATS).optional().default("csv"),
    })
    .strict()
    .superRefine(checkCommonRules);

export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;
export type ExportQueryInput = z.infer<typeof exportQuerySchema>;
