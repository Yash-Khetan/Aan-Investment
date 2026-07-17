/* ============================================================
   AMOUNT HELPERS
   Drizzle's `numeric` columns are returned as strings to avoid
   floating-point precision loss at the driver level. Convert to
   a number only at the export boundary, rounding to 2 decimals.
============================================================ */

export function toAmount(value: string | number | null | undefined): number {
    if (value === null || value === undefined) {
        return 0;
    }

    const parsed = typeof value === "number" ? value : Number.parseFloat(value);

    if (Number.isNaN(parsed)) {
        return 0;
    }

    return Math.round(parsed * 100) / 100;
}
