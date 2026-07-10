const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/* ============================================================
   DATE HELPERS
============================================================ */

export function isValidIsoDate(value: string): boolean {
    if (!ISO_DATE_PATTERN.test(value)) {
        return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime());
}

export function toDisplayDate(value: string | Date | null | undefined): string {
    if (!value) {
        return "";
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toISOString().slice(0, 10);
}

export function toDisplayTimestamp(value: string | Date | null | undefined): string {
    if (!value) {
        return "";
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toISOString();
}
