import { Button } from "../../../components/ui/Button";
import { formatAccrualMonth, formatCurrency, formatDate } from "../../../lib/format";
import { EmptyState } from "../../../components/ui/States";
import { InfoPopover } from "../../../components/ui/Tooltip";
import type { LedgerEntry, ReceiptAllocation } from "../types";
import { BalanceBifurcationCell } from "./BalanceBifurcation";

/** What may be done with the rows: omitted (the ledger renders read-only) or the handlers the Ledger tab passes. */
interface RowActions {
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
  /** The row whose edit form is open. */
  editingId?: string | null;
  /** The row being removed right now. */
  deletingId?: string | null;
}

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

/**
 * Why a row cannot be changed, shown on the row itself: a lock on an imported
 * entry, "Automatic" on a month-end journal the ledger posted and recomputes.
 * The wording is the server's own `lockReason`, so the explanation here and
 * the one a refused request gives are the same sentence.
 */
function EntryStateBadge({ entry }: { entry: LedgerEntry }) {
  if (entry.isEditable) return null;

  return (
    <>
      <span
        className={`ml-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          entry.isLocked ? "bg-slate-200 text-slate-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {entry.isLocked ? "Locked" : "Automatic"}
      </span>
      {entry.lockReason && (
        <InfoPopover label={entry.isLocked ? "Why this entry is locked" : "Why this entry is not edited here"}>
          {entry.lockReason}
        </InfoPopover>
      )}
    </>
  );
}

/** Edit and Remove, for a hand-recorded entry. Anything else gets a dash with the reason beside it. */
function RowActionsCell({ entry, actions }: { entry: LedgerEntry; actions: RowActions }) {
  if (!entry.isEditable) {
    return (
      <span className="text-slate-400" title={entry.lockReason ?? ""}>
        —
      </span>
    );
  }

  const isDeleting = actions.deletingId === entry.id;

  return (
    <span className="flex flex-nowrap gap-1">
      <Button
        variant="secondary"
        className="px-2 py-1 text-xs"
        disabled={isDeleting}
        onClick={() => actions.onEdit(entry)}
      >
        {actions.editingId === entry.id ? "Editing…" : "Edit"}
      </Button>
      <Button
        variant="ghost"
        className="px-2 py-1 text-xs text-dr"
        disabled={isDeleting}
        onClick={() => actions.onDelete(entry)}
      >
        {isDeleting ? "Removing…" : "Remove"}
      </Button>
    </span>
  );
}

const HEADER_CELL = "whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold text-slate-500";

/**
 * The ledger as posted, then — separately — whatever is scheduled.
 *
 * Which rows may be changed is the server's answer, carried on each row:
 *
 *   - an IMPORTED row is LOCKED. It shows a lock, offers no Edit or Remove,
 *     and says why. The figures are the client's own sheet's; they go only by
 *     removing the whole import on the Imported history tab.
 *   - a month-end Interest/TDS journal shows "Automatic". The rates and
 *     day-count a month accrues at come from the Loan module's interest
 *     configuration, and each posted row keeps the configuration it was
 *     calculated under, so it is not typed over here.
 *   - a Payment or Receipt recorded by hand can be edited or removed.
 *
 * None of that is enforced by this table. The buttons follow what the server
 * already decided (modules/ledger/entryRules.ts), and it checks again on the
 * request itself.
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
export function LedgerTable({ entries, actions }: { entries: LedgerEntry[]; actions?: RowActions }) {
  if (entries.length === 0) {
    return <EmptyState message="No records yet for this loan. Add one using the form above." />;
  }

  const posted = entries.filter((e) => !e.isScheduled);
  const scheduled = entries.filter((e) => e.isScheduled);

  return (
    <div className="flex flex-col gap-6">
      {posted.length > 0 ? (
        <PostedTable entries={posted} actions={actions} />
      ) : (
        <EmptyState message="Nothing posted yet." />
      )}
      {scheduled.length > 0 && <ScheduledTable entries={scheduled} actions={actions} />}
    </div>
  );
}

function PostedTable({ entries, actions }: { entries: LedgerEntry[]; actions?: RowActions }) {
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
            {actions && <th className={HEADER_CELL}>Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-300 bg-white">
          {entries.map((row) => (
            <tr key={row.id} className={`align-top ${row.id === actions?.editingId ? "bg-accent-soft" : ""}`}>
              <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{formatDate(row.entryDate)}</td>
              <td className="max-w-xs truncate px-4 py-2.5 text-slate-700" title={row.narration ?? ""}>
                {row.narration || "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <VchTypeBadge vchType={row.vchType} />
                <EntryStateBadge entry={row} />
                {row.allocation && (
                  <InfoPopover label="How this receipt was applied">
                    <ReceiptAllocationDetails allocation={row.allocation} />
                  </InfoPopover>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                {row.vchNo}
                {row.sourceVchNo && <span className="ml-1.5 text-xs text-slate-400">sheet {row.sourceVchNo}</span>}
              </td>
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
              {actions && (
                <td className="whitespace-nowrap px-4 py-2.5">
                  <RowActionsCell entry={row} actions={actions} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduledTable({ entries, actions }: { entries: LedgerEntry[]; actions?: RowActions }) {
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
              {actions && <th className={HEADER_CELL}>Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-slate-500">
            {entries.map((row) => (
              <tr key={row.id} className={row.id === actions?.editingId ? "bg-accent-soft" : undefined}>
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
                {actions && (
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <RowActionsCell entry={row} actions={actions} />
                  </td>
                )}
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
              {actions && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
