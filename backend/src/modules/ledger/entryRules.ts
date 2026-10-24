/**
 * Which ledger rows may be changed, and what about them may change — pure,
 * no database. The Ledger read, the edit route and the delete route all
 * decide from this one module, so the Edit button a user sees and the answer
 * the server gives can never disagree.
 *
 * Three kinds of row, three answers:
 *
 *   IMPORT  — LOCKED. The row states what a client's own ledger sheet stated.
 *             It is read-only for good; the only thing that removes it is
 *             removing the whole import (the loan's Imported history tab).
 *   SYSTEM  — the ledger's own month-end Interest/TDS pair. Not locked, but
 *             not editable either: its amount is recalculated from the
 *             configuration the month was accrued under, so a hand-typed
 *             figure would be overwritten the next time anything backdated
 *             landed before it.
 *   MANUAL  — a Payment or Receipt somebody recorded on the Ledger tab. This
 *             is the only editable row, and only its date, side, amount and
 *             narration may change.
 *
 * Everything else a row carries is derived or system-assigned and is never
 * accepted from a request: `vchNo` (the loan's own voucher sequence),
 * `debit`/`credit` (the side is chosen by `vchType`, the figure by `amount`),
 * `ratePercent`, `interestBasis`, `includeOpeningClosingDays` and
 * `accrualMonth` (a posted month's snapshot of what it accrued under),
 * `pairedEntryId`, `source`, `importId`, `sourceVchType`, `sourceVchNo`,
 * `sequenceNo` and `loanId`.
 */

import type { LedgerEntryRow } from "./ledger.repository";

/** The only voucher types a person records by hand, and so the only editable ones. */
export const EDITABLE_VCH_TYPES = ["PAYMENT", "RECEIPT"] as const;

export type EditableVchType = (typeof EDITABLE_VCH_TYPES)[number];

/** The fields of an entry that may be edited, as the API and the audit trail talk about them. */
export interface EntryFields {
  entryDate: string;
  vchType: EditableVchType;
  /** Always positive. Which side it lands on is `vchType`'s business. */
  amount: number;
  narration: string | null;
}

/** A request to change some of them. An absent key means "leave as it is". */
export interface EntryPatch {
  entryDate?: string;
  vchType?: EditableVchType;
  amount?: number;
  narration?: string | null;
}

/** What may be done with one row, and — when the answer is nothing — why. */
export interface EntryPermissions {
  /** Read-only for good, because an import posted it. */
  isLocked: boolean;
  /** May be edited or deleted. */
  isEditable: boolean;
  /** Plain-English reason the row cannot be changed. Null when it can. */
  lockReason: string | null;
}

/** Only what deciding any of this needs — so callers can ask about a row they have not fully loaded. */
export type EntryProvenance = Pick<LedgerEntryRow, "vchType" | "source" | "lockedAt">;

export const LOCKED_REASON =
  "Imported from a ledger sheet, so it is locked. Imported records keep exactly the figures the sheet stated. " +
  "To take them out, remove the whole import on the loan's Imported history tab.";

export const SYSTEM_REASON =
  "Posted by the ledger's own month-end run. Its amount is recalculated from the interest configuration the month " +
  "was accrued under, so it is not edited here — change the loan's interest configuration instead.";

export const NOT_MANUAL_REASON = "Only a Payment or Receipt recorded by hand can be edited.";

/**
 * Whether a row is locked. `source = 'IMPORT'` counts on its own, alongside
 * the persisted `lockedAt` that every imported row is inserted with: the two
 * are set together, and a row whose provenance is an import must never become
 * editable because one of them is missing.
 */
export function isEntryLocked(entry: EntryProvenance): boolean {
  return entry.lockedAt !== null || entry.source === "IMPORT";
}

export function describeEntry(entry: EntryProvenance): EntryPermissions {
  if (isEntryLocked(entry)) {
    return { isLocked: true, isEditable: false, lockReason: LOCKED_REASON };
  }
  if (entry.source === "SYSTEM") {
    return { isLocked: false, isEditable: false, lockReason: SYSTEM_REASON };
  }
  if (!(EDITABLE_VCH_TYPES as readonly string[]).includes(entry.vchType)) {
    return { isLocked: false, isEditable: false, lockReason: NOT_MANUAL_REASON };
  }
  return { isLocked: false, isEditable: true, lockReason: null };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** An entry's editable fields as they stand. */
export function entryFields(entry: LedgerEntryRow): EntryFields {
  return {
    entryDate: entry.entryDate,
    vchType: entry.vchType as EditableVchType,
    amount: round2(Number(entry.debit ?? entry.credit ?? 0)),
    narration: entry.narration ?? null,
  };
}

/** The same fields with a patch applied. An empty narration clears it, as recording one does. */
export function patchFields(fields: EntryFields, patch: EntryPatch): EntryFields {
  const narration = patch.narration === undefined ? fields.narration : patch.narration?.trim() || null;
  return {
    entryDate: patch.entryDate ?? fields.entryDate,
    vchType: patch.vchType ?? fields.vchType,
    amount: patch.amount === undefined ? fields.amount : round2(patch.amount),
    narration,
  };
}

/**
 * The row columns a set of fields becomes. A Payment is a debit (it increases
 * the balance), a Receipt a credit — the same rule the insert path uses, so an
 * edited row is indistinguishable from one recorded that way to begin with.
 */
export function toRowValues(fields: EntryFields): {
  entryDate: string;
  vchType: EditableVchType;
  debit: string | null;
  credit: string | null;
  narration: string | null;
} {
  const amount = fields.amount.toFixed(2);
  return {
    entryDate: fields.entryDate,
    vchType: fields.vchType,
    debit: fields.vchType === "PAYMENT" ? amount : null,
    credit: fields.vchType === "RECEIPT" ? amount : null,
    narration: fields.narration,
  };
}

/**
 * Only the fields that actually moved, before and after — what the audit trail
 * records. Null when the request changes nothing, which is how the edit path
 * knows to do nothing at all rather than recompute and log a non-event.
 */
export function diffFields(
  before: EntryFields,
  after: EntryFields,
): { before: Partial<EntryFields>; after: Partial<EntryFields> } | null {
  const oldValues: Partial<EntryFields> = {};
  const newValues: Partial<EntryFields> = {};

  for (const key of ["entryDate", "vchType", "amount", "narration"] as const) {
    if (before[key] !== after[key]) {
      Object.assign(oldValues, { [key]: before[key] });
      Object.assign(newValues, { [key]: after[key] });
    }
  }

  return Object.keys(newValues).length === 0 ? null : { before: oldValues, after: newValues };
}
