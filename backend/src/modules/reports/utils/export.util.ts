import ExcelJS from "exceljs";
import { Parser as CsvParser } from "json2csv";

import type { ReportColumn } from "../types/report.types";

/**
 * Converts rows to a CSV string using the given column order/labels.
 * Returns a header-only CSV when there is no data, so exports never
 * silently fail on an empty report.
 */
export function buildCsv<T extends Record<string, unknown>>(
    rows: T[],
    columns: ReportColumn<T>[],
): string {
    const parser = new CsvParser<T>({
        fields: columns.map((column) => ({
            label: column.label,
            value: column.key,
            default: "",
        })),
    });

    if (rows.length === 0) {
        return `${columns.map((column) => `"${column.label}"`).join(",")}\n`;
    }

    return parser.parse(rows);
}

/**
 * Converts rows to an .xlsx workbook buffer using the given column
 * order/labels, styling the header row for readability.
 */
export async function buildExcel<T extends Record<string, unknown>>(
    rows: T[],
    columns: ReportColumn<T>[],
    sheetName: string,
): Promise<ExcelJS.Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Aan Investment - Reports Module";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

    sheet.columns = columns.map((column) => ({
        header: column.label,
        key: column.key,
        width: Math.max(column.label.length + 4, 16),
    }));

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
    };

    for (const row of rows) {
        sheet.addRow(row);
    }

    return workbook.xlsx.writeBuffer();
}
