type LogLevel = "info" | "warn" | "error";

interface LogFields {
    [key: string]: string | number | boolean | null | undefined;
}

function write(level: LogLevel, message: string, fields?: LogFields): void {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        module: "reports",
        message,
        ...fields,
    };

    const line = JSON.stringify(entry);

    if (level === "error") {
        console.error(line);
    } else if (level === "warn") {
        console.warn(line);
    } else {
        console.log(line);
    }
}

/**
 * Minimal structured logger for the reports module.
 * Callers must only pass identifiers (report names, ids, durations) —
 * never raw customer PII or full row data — via `fields`.
 */
export const reportsLogger = {
    info: (message: string, fields?: LogFields) => write("info", message, fields),
    warn: (message: string, fields?: LogFields) => write("warn", message, fields),
    error: (message: string, fields?: LogFields) => write("error", message, fields),
};
