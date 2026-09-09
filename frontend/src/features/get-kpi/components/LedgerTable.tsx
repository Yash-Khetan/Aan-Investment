import { Fragment, useState } from "react";
import { Button } from "../../../components/ui/Button";
import type { KpiLedgerRow, KpiLedgerRowInput } from "../types";

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

const EDITABLE_FIELDS = ["date", "particulars", "vchType", "vchNo", "debit", "credit", "balance"] as const;

function toInput(row: KpiLedgerRow): KpiLedgerRowInput {
  return {
    date: row.date,
    particulars: row.particulars,
    vchType: row.vchType,
    vchNo: row.vchNo,
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
  };
}

const cell = "whitespace-nowrap px-3 py-2 text-slate-700";
const editInput =
  "w-full min-w-[6rem] rounded border border-slate-300 px-1.5 py-1 text-sm focus:border-slate-500 focus:outline-none";

/**
 * Shared ledger table. Read-only unless `onEditRow` / `onDeleteRow` are supplied,
 * in which case each row gets an inline edit mode and a delete button. Every
 * value is rendered as its raw stored string.
 */
export function LedgerTable({
  rows,
  onEditRow,
  onDeleteRow,
  busy = false,
}: {
  rows: KpiLedgerRow[];
  onEditRow?: (id: string, patch: KpiLedgerRowInput) => void;
  onDeleteRow?: (id: string) => void;
  busy?: boolean;
}) {
  const editable = Boolean(onEditRow || onDeleteRow);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<KpiLedgerRowInput | null>(null);

  function startEdit(row: KpiLedgerRow) {
    setEditingId(row.id);
    setDraft(toInput(row));
  }
  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }
  function saveEdit(id: string) {
    if (draft) onEditRow?.(id, draft);
    cancelEdit();
  }

  const headers = ["Date", "Particulars", "Vch Type", "Vch No.", "Debit", "Credit", "Balance"];

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {h}
              </th>
            ))}
            {editable && <th className="px-3 py-2.5" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => {
            const isEditing = editingId === row.id;
            return (
              <Fragment key={row.id}>
                <tr className="hover:bg-slate-50">
                  {isEditing && draft ? (
                    EDITABLE_FIELDS.map((field) => (
                      <td key={field} className="px-2 py-1.5">
                        <input
                          className={editInput}
                          value={draft[field] ?? ""}
                          onChange={(e) =>
                            setDraft({ ...draft, [field]: e.target.value === "" ? null : e.target.value })
                          }
                        />
                      </td>
                    ))
                  ) : (
                    <>
                      <td className={cell}>{row.date ?? "—"}</td>
                      <td className="max-w-md px-3 py-2 text-slate-700" title={row.particulars}>
                        {row.particulars || "—"}
                      </td>
                      <td className={cell}>
                        <VchTypeBadge vchType={row.vchType} />
                      </td>
                      <td className={cell}>{row.vchNo ?? "—"}</td>
                      <td className={`${cell} text-red-700`}>{row.debit ?? "—"}</td>
                      <td className={`${cell} text-emerald-700`}>{row.credit ?? "—"}</td>
                      <td className={`${cell} font-medium text-slate-900`}>{row.balance ?? "—"}</td>
                    </>
                  )}

                  {editable && (
                    <td className="whitespace-nowrap px-3 py-1.5 text-right">
                      {isEditing ? (
                        <span className="flex justify-end gap-1">
                          <Button variant="secondary" onClick={() => saveEdit(row.id)} disabled={busy}>
                            Save
                          </Button>
                          <Button variant="ghost" onClick={cancelEdit} disabled={busy}>
                            Cancel
                          </Button>
                        </span>
                      ) : (
                        <span className="flex justify-end gap-1">
                          {onEditRow && (
                            <Button variant="ghost" onClick={() => startEdit(row)} disabled={busy}>
                              Edit
                            </Button>
                          )}
                          {onDeleteRow && (
                            <Button variant="ghost" className="text-red-600" onClick={() => onDeleteRow(row.id)} disabled={busy}>
                              Delete
                            </Button>
                          )}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
