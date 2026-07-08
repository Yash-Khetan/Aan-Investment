/** Returns true when `value` parses to a real calendar date (e.g. "2026-07-08"). */
export function isValidDateString(value: string): boolean {
    if (!value || typeof value !== "string") {
        return false;
    }

    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
}

/** Formats a date input as a `YYYY-MM-DD` string, or null when absent/invalid. */
export function formatDate(value: string | Date | null | undefined): string | null {
    if (!value) {
        return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed.toISOString().slice(0, 10);
}

/** Returns true when `value` is a date strictly before `referenceDate` (defaults to now). */
export function isPastDate(value: string | Date | null | undefined, referenceDate: Date = new Date()): boolean {
    if (!value) {
        return false;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return false;
    }

    return parsed.getTime() < referenceDate.getTime();
}
