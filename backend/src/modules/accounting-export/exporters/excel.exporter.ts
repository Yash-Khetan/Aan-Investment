import ExcelJS from "exceljs";

import { ACCOUNTING_ENTRY_COLUMNS } from "../constants/export-formats.constants.js";
import type { AccountingEntryRow } from "../types/accounting-export.types.js";

const AMOUNT_COLUMN_KEYS = new Set<string>([
    "principalAmount",
    "interestAmount",
    "penaltyAmount",
    "fees",
    "taxAmount",
    "totalAmount",
]);

/* ============================================================
   EXCEL EXPORTER (ExcelJS)
============================================================ */

export async function buildExcelBuffer(
    rows: AccountingEntryRow[],
    sheetName: string,
): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Aan Investment LMS — Accounting Export";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));

    worksheet.columns = ACCOUNTING_ENTRY_COLUMNS.map((column) => ({
        header: column.header,
        key: column.key,
        width: column.key === "customerName" || column.key === "remarks" ? 28 : 18,
        style: AMOUNT_COLUMN_KEYS.has(column.key)
            ? { numFmt: "#,##0.00" }
            : undefined,
    }));

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
    };

    for (const row of rows) {
        worksheet.addRow(row);
    }

    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: ACCOUNTING_ENTRY_COLUMNS.length },
    };

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
}
