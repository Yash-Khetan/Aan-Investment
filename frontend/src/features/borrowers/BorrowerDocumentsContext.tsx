import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { DocumentMetadata } from "../documents/types";

/**
 * The identity documents a borrower form can attach, keyed by the backend's
 * `document_type` enum values.
 *
 * CKYC intentionally maps to `KYC`: the enum has no `CKYC` value, and nothing
 * else on a borrower uses `KYC`, so there is no ambiguity in practice.
 */
export type BorrowerDocumentType = "PAN_CARD" | "AADHAAR" | "KYC";

/** Display names, used as the document's `name` when uploading and in error messages. */
export const BORROWER_DOCUMENT_LABELS: Record<BorrowerDocumentType, string> = {
  PAN_CARD: "PAN",
  AADHAAR: "Aadhaar",
  KYC: "CKYC",
};

/**
 * Files picked before the borrower exists, held in memory until there is an id
 * to attach them to. Never persisted — see the note in CreateBorrowerPage.
 */
export type PendingBorrowerFiles = Partial<Record<BorrowerDocumentType, File>>;

interface BorrowerDocumentsValue {
  /** Absent on a borrower that has not been created yet. */
  borrowerId?: string;
  documents?: DocumentMetadata[];
  pendingFiles: PendingBorrowerFiles;
  setPendingFile: (documentType: BorrowerDocumentType, file: File | null) => void;
}

/**
 * A no-op default rather than a thrown error: an identity field rendered
 * outside a provider degrades to "create mode, nothing pending" instead of
 * crashing the page it sits on.
 */
const DEFAULT_VALUE: BorrowerDocumentsValue = {
  pendingFiles: {},
  setPendingFile: () => {},
};

const BorrowerDocumentsContext = createContext<BorrowerDocumentsValue>(DEFAULT_VALUE);

export function BorrowerDocumentsProvider({
  borrowerId,
  documents,
  pendingFiles,
  setPendingFile,
  children,
}: {
  borrowerId?: string;
  documents?: DocumentMetadata[];
  pendingFiles: PendingBorrowerFiles;
  setPendingFile: (documentType: BorrowerDocumentType, file: File | null) => void;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ borrowerId, documents, pendingFiles, setPendingFile }),
    [borrowerId, documents, pendingFiles, setPendingFile],
  );

  return <BorrowerDocumentsContext.Provider value={value}>{children}</BorrowerDocumentsContext.Provider>;
}

/** Everything one identity field needs, narrowed to its own document type. */
export function useBorrowerDocument(documentType: BorrowerDocumentType) {
  const { borrowerId, documents, pendingFiles, setPendingFile } = useContext(BorrowerDocumentsContext);

  return {
    borrowerId,
    existingDoc: documents?.find((d) => d.documentType === documentType),
    pendingFile: pendingFiles[documentType] ?? null,
    setPendingFile: (file: File | null) => setPendingFile(documentType, file),
  };
}
