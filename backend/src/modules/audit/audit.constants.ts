/**
 * The entity types the audit trail names. One constant per kind of record, so
 * a trail can be read back by `entity_type` without guessing at spellings.
 */
export const AUDIT_ENTITY = {
    LEDGER_ENTRY: "LEDGER_ENTRY",
    LEDGER_IMPORT: "LEDGER_IMPORT",
} as const;

export type AuditEntityType = (typeof AUDIT_ENTITY)[keyof typeof AUDIT_ENTITY];
