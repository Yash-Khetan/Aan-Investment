/* ============================================================
   MODULE LOGGER
   Structured, dependency-free logging for the accounting-export
   module. Only ever log operational metadata (category, format,
   row counts, duration, filter keys used) — never borrower PII,
   account numbers' surrounding customer data, or raw query
   results.
============================================================ */

type LogFields = Record<string, string | number | boolean | undefined>;

function format(level: string, message: string, fields?: LogFields): string {
    const parts = [`[accounting-export] [${level}]`, message];

    if (fields) {
        const fieldStr = Object.entries(fields)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => `${key}=${value}`)
            .join(" ");

        if (fieldStr) {
            parts.push(fieldStr);
        }
    }

    return parts.join(" ");
}

export const logger = {
    info(message: string, fields?: LogFields): void {
        console.log(format("INFO", message, fields));
    },

    warn(message: string, fields?: LogFields): void {
        console.warn(format("WARN", message, fields));
    },

    error(message: string, fields?: LogFields): void {
        console.error(format("ERROR", message, fields));
    },
};
