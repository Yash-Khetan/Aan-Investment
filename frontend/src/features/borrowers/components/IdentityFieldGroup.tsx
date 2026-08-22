import type { InputHTMLAttributes } from "react";
import { useBorrowerDocument, type BorrowerDocumentType } from "../BorrowerDocumentsContext";
import { IdentityDocumentField } from "./IdentityDocumentField";

/**
 * One bordered unit per identity document — number field on top, its matching
 * upload directly beneath, both under a single heading. Keeps the pairing
 * between "PAN number" and "PAN file" visually obvious, instead of the two
 * living as unrelated-looking cells scattered across a generic form grid.
 *
 * `required` applies to the number only. The upload is always optional.
 */
export function IdentityFieldGroup({
  heading,
  documentType,
  required,
  value,
  onValueChange,
  inputProps,
}: {
  heading: string;
  documentType: BorrowerDocumentType;
  required?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">;
}) {
  const { borrowerId, existingDoc, pendingFile, setPendingFile } = useBorrowerDocument(documentType);

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
      <IdentityDocumentField
        label={heading}
        documentType={documentType}
        borrowerId={borrowerId}
        existingDoc={existingDoc}
        pendingFile={pendingFile}
        onPendingFileChange={setPendingFile}
      />
      <p className="mt-1.5 text-xs text-slate-400">Optional &mdash; attach a PDF or photo of this document.</p>
    </div>
  );
}
