import { formatAccrualMonth, formatCurrency, formatDate } from "../../../lib/format";
import { EmptyState } from "../../../components/ui/States";
import { InfoPopover } from "../../../components/ui/Tooltip";
import type { LedgerEntry, ReceiptAllocation } from "../types";
import { BalanceBifurcationCell } from "./BalanceBifurcation";

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

/** What one Receipt paid off: interest oldest month first, then principal with whatever was left. */
function ReceiptAllocationDetails({ allocation }: { allocation: ReceiptAllocation }) {
  return (
    <>
      <span className="mb-1.5 block font-semibold">Receipt applied to</span>
      {allocation.interest.map((m) => (
        <span key={m.month} className="flex justify-between gap-4">
          <span>
            {formatAccrualMonth(m.month)} interest{" "}
            <span className="text-slate-400">({m.cleared ? "cleared" : "part"})</span>
          </span>
          <span className="tabular-nums">{formatCurrency(m.amount, 2)}</span>
        </span>
      ))}
      {allocation.principal > 0 && (
        <span className="flex justify-between gap-4">
          <span>Principal</span>
          <span className="tabular-nums">{formatCurrency(allocation.principal, 2)}</span>
        </span>
      )}
      {allocation.interest.length === 0 && allocation.principal === 0 && <span>Nothing — zero amount.</span>}
    </>
  );
}

const HEADER_CELL = "whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold text-slate-500";

/**
 * The ledger as posted, then — separately — whatever is scheduled. Rows are
 * not editable here: the rates and day-count a month accrues at come from the
 * Loan module's interest configuration, and each posted row keeps the
 * configuration it was calculated under.
 *
 * Balance Bifurcation splits each posted row's running balance into principal
 * and the months whose interest is still unpaid, one mini-row each. Receipts
 * carry an (i) showing which months' interest, and how much principal, they
 * paid.
 *
 * A Payment or Receipt dated after today is scheduled. It counts in no figure
 * until its date arrives, so it is listed below the posted ledger with its own
 * total rather than inside it — the last posted balance is always today's.
 */
export function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState message="No records yet for this loan. Add one using the form above." />;
  }

  const posted = entries.filter((e) => !e.isScheduled);
  const scheduled = entries.filter((e) => e.isScheduled);

  return (
    <div className="flex flex-col gap-6">
      {posted.length > 0 ? <PostedTable entries={posted} /> : <EmptyState message="Nothing posted yet." />}
      {scheduled.length > 0 && <ScheduledTable entries={scheduled} />}
    </div>
  );
}

function PostedTable({ entries }: { entries: LedgerEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-300">
      <table className="min-w-full divide-y divide-slate-300 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {["Date", "Particulars", "Vch Type", "Vch No.", "Debit", "Credit", "Balance", "Balance Bifurcation"].map((h) => (
              <th key={h} className={HEADER_CELL}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-300 bg-white">
          {entries.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{formatDate(row.entryDate)}</td>
              <td className="max-w-xs truncate px-4 py-2.5 text-slate-700" title={row.narration ?? ""}>
                {row.narration || "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <VchTypeBadge vchType={row.vchType} />
                {row.allocation && (
                  <InfoPopover label="How this receipt was applied">
                    <ReceiptAllocationDetails allocation={row.allocation} />
                  </InfoPopover>
                )}
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
              <td className="border-l border-slate-300 p-0">
                <BalanceBifurcationCell bifurcation={row.bifurcation} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduledTable({ entries }: { entries: LedgerEntry[] }) {
  const totalDebit = entries.reduce((sum, r) => sum + (r.debit ? Number(r.debit) : 0), 0);
  const totalCredit = entries.reduce((sum, r) => sum + (r.credit ? Number(r.credit) : 0), 0);

  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-900">Scheduled</h3>
      <p className="mb-2 text-xs text-slate-500">
        Dated after today. Not counted in the balance, dues or any other figure until their date arrives.
      </p>
      <div className="overflow-x-auto rounded-lg border border-dashed border-slate-300">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Date", "Particulars", "Vch Type", "Vch No.", "Debit", "Credit"].map((h) => (
                <th key={h} className={HEADER_CELL}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-slate-500">
            {entries.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap px-4 py-2.5">{formatDate(row.entryDate)}</td>
                <td className="max-w-xs truncate px-4 py-2.5" title={row.narration ?? ""}>
                  {row.narration || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <VchTypeBadge vchType={row.vchType} />
                  <span className="ml-1.5 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    Scheduled
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">{row.vchNo}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{row.debit != null ? formatCurrency(row.debit, 2) : "—"}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{row.credit != null ? formatCurrency(row.credit, 2) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-medium text-slate-700">
            <tr>
              <td className="px-4 py-2.5" colSpan={4}>
                Total scheduled
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">{formatCurrency(totalDebit, 2)}</td>
              <td className="whitespace-nowrap px-4 py-2.5">{formatCurrency(totalCredit, 2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
