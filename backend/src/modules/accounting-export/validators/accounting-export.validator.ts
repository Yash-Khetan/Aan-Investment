import {
    EXPORT_FORMATS,
    TRANSACTION_TYPES,
    type AccountingExportFilters,
    type ExportFormat,
} from "../types/accounting-export.types.js";
import { isValidIsoDate } from "../utils/date.utils.js";
import { ValidationError } from "../utils/http-error.utils.js";

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asSingleString(value: unknown): string | undefined {
    if (Array.isArray(value)) {
        return typeof value[0] === "string" ? value[0] : undefined;
    }

    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function validateUuidParam(value: string | undefined, field: string): string | undefined {
    if (value === undefined) {
        return undefined;
    }

    if (!UUID_PATTERN.test(value)) {
        throw new ValidationError(`Invalid ${field}: must be a valid UUID.`);
    }

    return value;
}

/* ============================================================
   FILTER VALIDATION
============================================================ */

export function parseAccountingExportFilters(
    query: Record<string, unknown>,
): AccountingExportFilters {
    const branchId = validateUuidParam(asSingleString(query.branchId), "branchId");
    const loanId = validateUuidParam(asSingleString(query.loanId), "loanId");
    const customerId = validateUuidParam(asSingleString(query.customerId), "customerId");

    const transactionTypeRaw = asSingleString(query.transactionType);
    let transactionType: AccountingExportFilters["transactionType"];

    if (transactionTypeRaw !== undefined) {
        const normalized = transactionTypeRaw.toUpperCase();

        if (!TRANSACTION_TYPES.includes(normalized as (typeof TRANSACTION_TYPES)[number])) {
            throw new ValidationError(
                `Invalid transactionType: must be one of ${TRANSACTION_TYPES.join(", ")}.`,
            );
        }

        transactionType = normalized as AccountingExportFilters["transactionType"];
    }

    const startDate = asSingleString(query.startDate);
    const endDate = asSingleString(query.endDate);

    if (startDate !== undefined && !isValidIsoDate(startDate)) {
        throw new ValidationError("Invalid startDate: expected format YYYY-MM-DD.");
    }

    if (endDate !== undefined && !isValidIsoDate(endDate)) {
        throw new ValidationError("Invalid endDate: expected format YYYY-MM-DD.");
    }

    if (startDate !== undefined && endDate !== undefined && startDate > endDate) {
        throw new ValidationError("Invalid date range: startDate must not be after endDate.");
    }

    return {
        branchId,
        loanId,
        customerId,
        transactionType,
        startDate,
        endDate,
    };
}

/* ============================================================
   EXPORT FORMAT VALIDATION
============================================================ */

export function parseExportFormat(query: Record<string, unknown>): ExportFormat {
    const raw = asSingleString(query.format) ?? "csv";
    const normalized = raw.toLowerCase();

    if (!EXPORT_FORMATS.includes(normalized as ExportFormat)) {
        throw new ValidationError(
            `Invalid format: must be one of ${EXPORT_FORMATS.join(", ")}.`,
        );
    }

    return normalized as ExportFormat;
}
