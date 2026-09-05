import { formatCurrency, formatDate } from "../../../lib/format";
import { EmptyState } from "../../../components/ui/States";
import type { LedgerEntry } from "../types";

const VCH_TYPE_CLASSES: Record<string, string> = {
  PAYMENT: "bg-red-100 text-red-800",
  RECEIPT: "bg-emerald-100 text-emerald-800",
  JOURNAL_INTEREST: "bg-blue-100 text-blue-800",
  JOURNAL_TDS: "bg-blue-100 text-blue-800",
};

const VCH_TYPE_LABELS: Record<string, string> = {
  PAYMENT: "Payment",
  RECEIPT: "Receipt",
  JOURNAL_INTEREST: "Journal",
  JOURNAL_TDS: "Journal",
};

function VchTypeBadge({ vchType }: { vchType: string }) {
  const classes = VCH_TYPE_CLASSES[vchType] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {VCH_TYPE_LABELS[vchType] ?? vchType}
    </span>
  );
}

/**
 * The ledger as posted. Rows are not editable here: the rates and day-count a
 * month accrues at come from the Loan module's interest configuration, and
 * each posted row keeps the configuration it was calculated under.
 */
export function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState message="No records yet for this loan. Add one using the form above." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {["Date", "Particulars", "Vch Type", "Vch No.", "Debit", "Credit", "Balance"].map((h) => (
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
          {entries.map((row) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{formatDate(row.entryDate)}</td>
              <td className="max-w-xs truncate px-4 py-2.5 text-slate-700" title={row.narration ?? ""}>
                {row.narration || "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <VchTypeBadge vchType={row.vchType} />
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{row.vchNo}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-red-700">
                {row.debit != null ? formatCurrency(row.debit, 2) : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-emerald-700">
                {row.credit != null ? formatCurrency(row.credit, 2) : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900">
                {formatCurrency(Math.abs(row.balance), 2)} {row.balance >= 0 ? "Dr" : "Cr"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
