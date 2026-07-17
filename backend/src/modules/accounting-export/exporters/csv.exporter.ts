import { Parser } from "json2csv";

import { ACCOUNTING_ENTRY_COLUMNS } from "../constants/export-formats.constants.js";
import type { AccountingEntryRow } from "../types/accounting-export.types.js";

/* ============================================================
   CSV EXPORTER (json2csv)
============================================================ */

export function buildCsv(rows: AccountingEntryRow[]): string {
    const parser = new Parser<AccountingEntryRow>({
        fields: ACCOUNTING_ENTRY_COLUMNS.map((column) => ({
            label: column.header,
            value: column.key,
        })),
    });

    return parser.parse(rows);
}
