import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { IdentityDocumentKind } from "./identityDocumentApi";
import type { Borrower } from "./types";

/** Display names, used in error messages and as the heading fallback. */
export const IDENTITY_DOCUMENT_LABELS: Record<IdentityDocumentKind, string> = {
  pan: "PAN",
  aadhaar: "Aadhaar",
  ckyc: "CKYC",
};

/**
 * Files picked before the borrower exists, held in memory until there is an id
 * to attach them to. Never persisted — see the note in CreateBorrowerPage.
 */
export type PendingBorrowerFiles = Partial<Record<IdentityDocumentKind, File>>;

/** The stored scan for one kind, read off the borrower record itself. */
export interface StoredIdentityDocument {
  path: string;
  name: string | null;
}

interface BorrowerDocumentsValue {
  /** Absent on a borrower that has not been created yet. */
  borrowerId?: string;
  borrower?: Borrower;
  pendingFiles: PendingBorrowerFiles;
  setPendingFile: (kind: IdentityDocumentKind, file: File | null) => void;
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
  borrower,
  pendingFiles,
  setPendingFile,
  children,
}: {
  borrowerId?: string;
  borrower?: Borrower;
  pendingFiles: PendingBorrowerFiles;
  setPendingFile: (kind: IdentityDocumentKind, file: File | null) => void;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ borrowerId, borrower, pendingFiles, setPendingFile }),
    [borrowerId, borrower, pendingFiles, setPendingFile],
  );

  return <BorrowerDocumentsContext.Provider value={value}>{children}</BorrowerDocumentsContext.Provider>;
}

/** Which pair of borrower fields backs each kind. */
function storedFor(borrower: Borrower | undefined, kind: IdentityDocumentKind): StoredIdentityDocument | undefined {
  if (!borrower) return undefined;

  const path = kind === "pan" ? borrower.panDocPath : kind === "aadhaar" ? borrower.aadhaarDocPath : borrower.ckycDocPath;
  if (!path) return undefined;

  const name = kind === "pan" ? borrower.panDocName : kind === "aadhaar" ? borrower.aadhaarDocName : borrower.ckycDocName;
  return { path, name };
}

/** Everything one identity field needs, narrowed to its own document kind. */
export function useBorrowerDocument(kind: IdentityDocumentKind) {
  const { borrowerId, borrower, pendingFiles, setPendingFile } = useContext(BorrowerDocumentsContext);

  return {
    borrowerId,
    storedDoc: storedFor(borrower, kind),
    pendingFile: pendingFiles[kind] ?? null,
    setPendingFile: (file: File | null) => setPendingFile(kind, file),
  };
}
