import { useState, type InputHTMLAttributes } from "react";
import { useBorrowerDocument } from "../BorrowerDocumentsContext";
import type { IdentityDocumentKind } from "../identityDocumentApi";
import { IdentityDocumentField } from "./IdentityDocumentField";

/**
 * One bordered unit per identity document - number field on top, its matching
 * upload directly beneath, both under a single heading. Keeps the pairing
 * between "PAN number" and "PAN file" visually obvious, instead of the two
 * living as unrelated-looking cells scattered across a generic form grid.
 *
 * When an uploaded photo is read successfully, the value is offered as a
 * suggestion rather than written into the field. OCR guesses, and a mis-read
 * must never silently replace a number the user typed - so filling the field
 * stays an explicit click.
 *
 * A failed or empty read says nothing at all: auto-fill is a convenience, and
 * the user can always just type the number, so there is nothing to report.
 *
 * `required` applies to the number only. The upload is always optional.
 */
export function IdentityFieldGroup({
  heading,
  kind,
  required,
  value,
  onValueChange,
  inputProps,
}: {
  heading: string;
  kind: IdentityDocumentKind;
  required?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">;
}) {
  const { borrowerId, storedDoc, pendingFile, setPendingFile } = useBorrowerDocument(kind);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  function applySuggestion() {
    if (!suggestion) return;
    onValueChange(suggestion);
    setSuggestion(null);
  }

  // Nothing to offer once the field already holds what was read.
  const showSuggestion = suggestion !== null && suggestion !== value;
  const hasFile = borrowerId ? Boolean(storedDoc) : Boolean(pendingFile);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {heading}
        {required && <span className="text-red-500"> *</span>}
      </div>
      <input
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        required={required}
        className="mb-2 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        {...inputProps}
      />

      {showSuggestion && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-indigo-50 px-2.5 py-1.5">
          <span className="min-w-0 text-xs text-indigo-900">
            Read from the image: <span className="font-semibold">{suggestion}</span>
          </span>
          <button
            type="button"
            onClick={applySuggestion}
            className="shrink-0 rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Use
          </button>
        </div>
      )}

      <IdentityDocumentField
        kind={kind}
        borrowerId={borrowerId}
        storedDoc={storedDoc}
        pendingFile={pendingFile}
        onPendingFileChange={setPendingFile}
        onOcrSuggestion={setSuggestion}
      />

      {!hasFile && <p className="mt-1.5 text-xs text-slate-400">Upload a clear photo (JPG/PNG)</p>}
    </div>
  );
}
