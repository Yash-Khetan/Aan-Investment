import type { InputHTMLAttributes } from "react";
import { useBorrowerDocument } from "../BorrowerDocumentsContext";
import type { IdentityDocumentKind } from "../identityDocumentApi";
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
        kind={kind}
        borrowerId={borrowerId}
        storedDoc={storedDoc}
        pendingFile={pendingFile}
        onPendingFileChange={setPendingFile}
      />
    </div>
  );
}
