/**
 * The entity types a change request can be filed against. One constant per
 * kind of record, so callers never hand-type the string.
 */
export const CHANGE_REQUEST_ENTITY = {
    LOAN: "LOAN",
    COLLATERAL: "COLLATERAL",
    COLLATERAL_INSURANCE: "COLLATERAL_INSURANCE",
    LEDGER_ENTRY: "LEDGER_ENTRY",
    LEDGER_IMPORT: "LEDGER_IMPORT",
} as const;
