import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../components/ui/Button";
import { ErrorState, LoadingState, SuccessState } from "../../../components/ui/States";
import { ApiError } from "../../../lib/api";
import { deleteEntry, getLedger } from "../../ledger/api";
import { EntryForm } from "../../ledger/components/EntryForm";
import { LedgerTable } from "../../ledger/components/LedgerTable";
import type { LedgerEntry } from "../../ledger/types";

/**
 * The loan's ledger: record a disbursement or receipt, then every entry with
 * its running balance and what that balance is made of. Month-end interest
 * and TDS entries are posted automatically.
 *
 * A Payment or Receipt recorded by hand can be edited or removed from here —
 * the form above the table switches to that entry. Imported entries are
 * locked and month-end journals are the ledger's own, so neither offers those
 * actions, and the server refuses them either way.
 */
export function LoanLedgerTab({ loanId }: { loanId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ledger", loanId],
    queryFn: () => getLedger(loanId),
  });

  // A new, edited or removed entry moves every figure about the loan, so refresh all of them.
  function refresh() {
    for (const queryKey of [["ledger", loanId], ["ledger-dpd", loanId], ["loan", loanId], ["loans"], ["lookup"], ["dashboard-summary"]]) {
      queryClient.invalidateQueries({ queryKey });
    }
  }

  async function handleDelete(entry: LedgerEntry) {
    const amount = entry.debit ?? entry.credit ?? "0";
    if (
      !window.confirm(
        `Remove Vch No. ${entry.vchNo} (${entry.vchType === "PAYMENT" ? "disbursement" : "receipt"} of ₹${amount} on ${entry.entryDate})?\n\n` +
          "Month-end interest from that date onward is recalculated.",
      )
    ) {
      return;
    }

    setActionError(null);
    setNotice(null);
    setDeletingId(entry.id);
    try {
      await deleteEntry(loanId, entry.id);
      if (editing?.id === entry.id) setEditing(null);
      setNotice(`Vch No. ${entry.vchNo} removed. Every figure on the loan has been recalculated.`);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not remove the entry.");
    } finally {
      setDeletingId(null);
    }
  }

  // The ledger is refetched after every change, so the row being edited is re-read from it.
  const editingEntry = editing ? (data?.entries.find((e) => e.id === editing.id) ?? editing) : null;

  return (
    <div className="flex flex-col gap-6">
      <EntryForm
        key={editingEntry?.id ?? "new"}
        loanId={loanId}
        entry={editingEntry ?? undefined}
        onSaved={() => {
          setActionError(null);
          refresh();
        }}
        onCancel={editingEntry ? () => setEditing(null) : undefined}
      />

      {notice && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="grow">
            <SuccessState message={notice} />
          </div>
          <Button variant="ghost" onClick={() => setNotice(null)}>
            Dismiss
          </Button>
        </div>
      )}
      {actionError && <ErrorState message={actionError} />}

      {isLoading && <LoadingState label="Loading ledger..." />}
      {isError && <ErrorState message={error instanceof ApiError ? error.message : "Could not load the ledger."} />}
      {data && (
        <LedgerTable
          entries={data.entries}
          actions={{
            onEdit: (entry) => {
              setActionError(null);
              setNotice(null);
              setEditing(entry);
              window.scrollTo({ top: 0, behavior: "smooth" });
            },
            onDelete: handleDelete,
            editingId: editingEntry?.id ?? null,
            deletingId,
          }}
        />
      )}
    </div>
  );
}
