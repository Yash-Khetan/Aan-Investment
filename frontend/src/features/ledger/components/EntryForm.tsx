import { useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { ErrorState, SuccessState } from "../../../components/ui/States";
import { ApiError } from "../../../lib/api";
import { createEntry, updateEntry } from "../api";
import type { LedgerEntry, UpdateEntryInput } from "../types";

/** Today in the user's own calendar — toISOString() would give yesterday's date before 05:30 IST. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface FormState {
  entryDate: string;
  vchType: "PAYMENT" | "RECEIPT";
  amount: string;
  narration: string;
}

function blankState(): FormState {
  return { entryDate: todayIso(), vchType: "PAYMENT", amount: "", narration: "" };
}

function stateOf(entry: LedgerEntry): FormState {
  return {
    entryDate: entry.entryDate,
    vchType: entry.vchType as "PAYMENT" | "RECEIPT",
    amount: String(Number(entry.debit ?? entry.credit ?? 0)),
    narration: entry.narration ?? "",
  };
}

/** Only what actually moved, so an edit never sends — or logs — a field it did not change. */
function changedFields(before: FormState, after: FormState, amount: number): UpdateEntryInput {
  const patch: UpdateEntryInput = {};
  if (after.entryDate !== before.entryDate) patch.entryDate = after.entryDate;
  if (after.vchType !== before.vchType) patch.vchType = after.vchType;
  if (amount !== Number(before.amount)) patch.amount = amount;
  if (after.narration.trim() !== before.narration.trim()) patch.narration = after.narration.trim() || null;
  return patch;
}

/**
 * The one form for money in or out: recording a new Payment/Receipt, and
 * editing one that was recorded by hand.
 *
 * `entry` switches it to editing that row. Only a row the server marked
 * editable ever gets here — an imported row is locked and a month-end journal
 * is the ledger's own — and the server checks that again on the request, so a
 * stale page cannot slip an edit past it.
 *
 * The Ledger tab keys this component by the entry's id, so moving to another
 * row remounts it with that row's values rather than carrying the last one's.
 */
export function EntryForm({
  loanId,
  entry,
  onSaved,
  onCancel,
}: {
  loanId: string;
  /** The entry being edited. Omitted to record a new one. */
  entry?: LedgerEntry;
  onSaved: () => void;
  /** Leave editing without saving. Omitted in record mode. */
  onCancel?: () => void;
}) {
  const isEditing = !!entry;
  const [initial, setInitial] = useState<FormState>(entry ? stateOf(entry) : blankState());
  const [form, setForm] = useState<FormState>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  const set =<K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors([]);
    setSaved(null);

    const parsedAmount = Number.parseFloat(form.amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    const patch = isEditing ? changedFields(initial, form, parsedAmount) : null;
    if (patch && Object.keys(patch).length === 0) {
      setError("Nothing has been changed yet.");
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing) {
        await updateEntry(loanId, entry.id, patch!);
        // What is now saved is what the next edit is measured against.
        setInitial({ ...form, amount: String(parsedAmount) });
        setSaved("Entry updated. Every figure on the loan has been recalculated.");
      } else {
        await createEntry(loanId, {
          entryDate: form.entryDate,
          vchType: form.vchType,
          amount: parsedAmount,
          narration: form.narration || undefined,
        });
        setForm(blankState());
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors((err.details ?? []).map((d) => `${d.field}: ${d.message}`));
      } else {
        setError(err instanceof Error ? err.message : `Failed to ${isEditing ? "save" : "add"} the record.`);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          {isEditing ? `Edit Vch No. ${entry.vchNo}` : "Record money in or out"}
        </h2>
        {isEditing && (
          <p className="text-xs text-slate-500">
            Date, type, amount and narration can change. The voucher number stays as it is.
          </p>
        )}
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <TextField
          label="Date"
          type="date"
          value={form.entryDate}
          onChange={(e) => set("entryDate", e.target.value)}
          required
        />
        <SelectField
          label="Type"
          value={form.vchType}
          onChange={(e) => set("vchType", e.target.value as "PAYMENT" | "RECEIPT")}
        >
          <option value="PAYMENT">Disbursement — paid to the borrower</option>
          <option value="RECEIPT">Receipt — received from the borrower</option>
        </SelectField>
        <TextField
          label="Amount (₹)"
          type="number"
          min="0"
          step="0.01"
          value={form.amount}
          onChange={(e) => set("amount", e.target.value)}
          required
        />
        <div className="lg:col-span-2">
          <TextAreaField label="Narration" value={form.narration} onChange={(e) => set("narration", e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-5">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (isEditing ? "Saving…" : "Recording…") : isEditing ? "Save changes" : "Record entry"}
          </Button>
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
          )}
        </div>
      </form>
      {saved && (
        <div className="mt-3">
          <SuccessState message={saved} />
        </div>
      )}
      {error && (
        <div className="mt-3">
          <ErrorState message={error} />
          {fieldErrors.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-red-700">
              {fieldErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
