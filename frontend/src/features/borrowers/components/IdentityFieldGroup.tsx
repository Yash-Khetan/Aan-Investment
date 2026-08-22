import { useState, type InputHTMLAttributes } from "react";
import { useBorrowerDocument } from "../BorrowerDocumentsContext";
import type { IdentityDocumentKind } from "../identityDocumentApi";
import { IdentityDocumentField, type OcrStatus } from "./IdentityDocumentField";

/**
 * One bordered unit per identity document - number field on top, its matching
 * upload directly beneath, both under a single heading. Keeps the pairing
 * between "PAN number" and "PAN file" visually obvious, instead of the two
 * living as unrelated-looking cells scattered across a generic form grid.
 *
 * When an uploaded image is read successfully, the value is offered as a
 * suggestion rather than written into the field. OCR guesses, and a mis-read
 * must never silently replace something the user typed - so filling the field
 * stays an explicit click.
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
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");
  const [suggestion, setSuggestion] = useState<string | null>(null);

  function handleOcrResult(status: OcrStatus, extracted: string | null) {
    setOcrStatus(status);
    setSuggestion(extracted);
  }

  function applySuggestion() {
    if (!suggestion) return;
    onValueChange(suggestion);
    setSuggestion(null);
    setOcrStatus("idle");
  }

  // Nothing to offer once the field already holds what OCR read.
  const showSuggestion = ocrStatus === "done" && suggestion !== null && suggestion !== value;

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
        onOcrResult={handleOcrResult}
      />

      {ocrStatus === "idle" && (
        <p className="mt-1.5 text-xs text-slate-400">
          Optional. Upload a clear photo (JPG/PNG) and the number can be read for you &mdash; PDFs upload fine but
          can&rsquo;t be read.
        </p>
      )}
      {ocrStatus === "reading" && <p className="mt-1.5 text-xs text-slate-400">Reading the image&hellip;</p>}
      {ocrStatus === "empty" && (
        <p className="mt-1.5 text-xs text-slate-400">Couldn&rsquo;t read a number from this image &mdash; type it above.</p>
      )}
      {ocrStatus === "skipped" && (
        <p className="mt-1.5 text-xs text-slate-400">
          PDFs can&rsquo;t be read automatically &mdash; type the number above, or upload a photo instead.
        </p>
      )}
      {ocrStatus === "failed" && (
        <p className="mt-1.5 text-xs text-slate-400">Auto-read failed &mdash; type the number above.</p>
      )}
    </div>
  );
}
