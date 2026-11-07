/**
 * Narrows a before/after pair down to just the fields an update actually
 * touched — what the audit trail is meant to hold ("the changed fields as
 * they were / as they became"), not a full redundant copy of the record.
 */
export function diffFields<T extends Record<string, unknown>>(
    existing: T,
    input: Partial<Record<keyof T, unknown>>,
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    for (const key of Object.keys(input) as (keyof T)[]) {
        oldValues[key as string] = existing[key];
        newValues[key as string] = input[key];
    }

    return { oldValues, newValues };
}
