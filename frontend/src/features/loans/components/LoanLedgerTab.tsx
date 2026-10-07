import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "../../../components/ui/States";
import { ApiError } from "../../../lib/api";
import { getLedger } from "../../ledger/api";
import { AddEntryForm } from "../../ledger/components/AddEntryForm";
import { LedgerTable } from "../../ledger/components/LedgerTable";

/**
 * The loan's ledger: record a disbursement or receipt, then every entry with
 * its running balance and what that balance is made of. Month-end interest
 * and TDS entries are posted automatically.
 */
export function LoanLedgerTab({ loanId }: { loanId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ledger", loanId],
    queryFn: () => getLedger(loanId),
  });

  // A new entry moves every figure about the loan, so refresh all of them.
  function refresh() {
    for (const queryKey of [["ledger", loanId], ["ledger-dpd", loanId], ["loan", loanId], ["loans"], ["lookup"], ["dashboard-summary"]]) {
      queryClient.invalidateQueries({ queryKey });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AddEntryForm loanId={loanId} onAdded={refresh} />
      {isLoading && <LoadingState label="Loading ledger..." />}
      {isError && <ErrorState message={error instanceof ApiError ? error.message : "Could not load the ledger."} />}
      {data && <LedgerTable entries={data.entries} />}
    </div>
  );
}
