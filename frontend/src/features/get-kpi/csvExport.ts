import type { LedgerRow } from "./types";

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Builds a CSV of the ledger table including saved parameters and the computed formula output
 * per row, so the client can open the exported report directly in Excel.
 */
export function buildLedgerCsv(rows: LedgerRow[]): string {
  const maxParams = rows.reduce((max, r) => Math.max(max, r.parameters.length), 0);
  const paramHeaders = Array.from({ length: maxParams }, (_, i) => [`Parameter ${i + 1} Name`, `Parameter ${i + 1} Value`]).flat();

  const header = [
    "Date",
    "Particulars",
    "Vch Type",
    "Vch No.",
    "Debit",
    "Credit",
    "Balance",
    ...paramHeaders,
    "Output Name",
    "Formula",
    "Output Value",
  ];

  const lines = rows.map((row) => {
    const paramCells = Array.from({ length: maxParams }, (_, i) => {
      const p = row.parameters[i];
      return p ? [p.name, p.isPercent ? `${(p.value * 100).toFixed(4)}%` : p.value] : ["", ""];
    }).flat();

    return [
      row.date ?? "",
      row.particulars,
      row.vchType ?? "",
      row.vchNo ?? "",
      row.debit ?? "",
      row.credit ?? "",
      row.balance != null ? `${Math.abs(row.balance).toFixed(2)} ${row.balance >= 0 ? "Dr" : "Cr"}` : "",
      ...paramCells,
      row.output?.name ?? "",
      row.output?.formula ?? "",
      row.output?.error ? `#ERROR: ${row.output.error}` : (row.output?.result ?? ""),
    ]
      .map(escapeCsvCell)
      .join(",");
  });

  return [header.map(escapeCsvCell).join(","), ...lines].join("\r\n");
}

export function downloadLedgerCsv(rows: LedgerRow[], fileName = "get-kpi-report.csv"): void {
  const csv = buildLedgerCsv(rows);
  // Prepend a BOM so Excel opens UTF-8 CSVs (e.g. the ₹ symbol, "—") without mangling characters.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
