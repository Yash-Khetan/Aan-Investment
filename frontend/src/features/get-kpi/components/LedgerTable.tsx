import { Fragment, useState } from "react";
import { formatCurrency, formatDate } from "../../../lib/format";
import type { LedgerRow, RowParameter } from "../types";
import { RowFormulaEditor } from "./RowFormulaEditor";

const VCH_TYPE_CLASSES: Record<string, string> = {
  payment: "bg-red-100 text-red-800",
  receipt: "bg-emerald-100 text-emerald-800",
  journal: "bg-blue-100 text-blue-800",
};

function VchTypeBadge({ vchType }: { vchType: string | null }) {
  if (!vchType) return <span className="text-slate-400">—</span>;
  const classes = VCH_TYPE_CLASSES[vchType.toLowerCase()] ?? "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>{vchType}</span>;
}

export function LedgerTable({
  rows,
  onUpdateParameters,
  onUpdateOutput,
}: {
  rows: LedgerRow[];
  onUpdateParameters: (rowId: string, parameters: RowParameter[]) => void;
  onUpdateOutput: (rowId: string, output: LedgerRow["output"]) => void;
}) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {["Date", "Particulars", "Vch Type", "Vch No.", "Debit", "Credit", "Balance", "Output"].map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => {
            const isExpanded = expandedRowId === row.id;
            return (
              <Fragment key={row.id}>
                <tr
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{formatDate(row.date)}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-slate-700" title={row.particulars}>
                    {row.particulars || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <VchTypeBadge vchType={row.vchType} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{row.vchNo ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-red-700">
                    {row.debit != null ? formatCurrency(row.debit, 2) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-emerald-700">
                    {row.credit != null ? formatCurrency(row.credit, 2) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900">
                    {row.balance != null
                      ? `${formatCurrency(Math.abs(row.balance), 2)} ${row.balance >= 0 ? "Dr" : "Cr"}`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                    {row.output ? (
                      row.output.error ? (
                        <span className="text-red-600" title={row.output.error}>
                          Error
                        </span>
                      ) : (
                        <span>
                          {row.output.name}: {row.output.result?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <RowFormulaEditor
                        row={row}
                        onSaveParameters={(parameters) => onUpdateParameters(row.id, parameters)}
                        onSaveOutput={(output) => onUpdateOutput(row.id, output)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
