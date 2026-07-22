import type { InputHTMLAttributes } from "react";
import type { DocumentMetadata } from "../../documents/types";
import type { OcrDocumentType } from "../../ocr/api";
import { IdentityDocumentField } from "./IdentityDocumentField";

/**
 * One bordered unit per identity document — number field on top, its matching
 * upload directly beneath, both under a single heading. Keeps the pairing
 * between "PAN number" and "PAN file" visually obvious, instead of the two
 * living as unrelated-looking cells scattered across a generic form grid.
 */
export function IdentityFieldGroup({
  heading,
  documentType,
  required,
  value,
  onValueChange,
  inputProps,
  borrowerId,
  documents,
  pendingFile,
  onPendingFileChange,
}: {
  heading: string;
  documentType: OcrDocumentType;
  required?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">;
  borrowerId?: string;
  documents?: DocumentMetadata[];
  pendingFile?: File | null;
  onPendingFileChange?: (file: File | null) => void;
}) {
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
        existingDoc={documents?.find((d) => d.documentType === documentType)}
        pendingFile={pendingFile}
        onPendingFileChange={onPendingFileChange}
        onExtracted={onValueChange}
        required={required}
      />
      <p className="mt-1.5 text-xs text-slate-400">Upload a clear, well-lit photo/scan for best auto-fill results.</p>
    </div>
  );
}
