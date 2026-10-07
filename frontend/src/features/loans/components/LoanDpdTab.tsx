import { useQuery } from "@tanstack/react-query";
import { getDpdHistory } from "../../ledger/api";
import { DpdHistoryTable } from "../../ledger/components/DpdHistoryTable";

/** Days past due for every month of the loan's life, read off its ledger. */
export function LoanDpdTab({ loanId }: { loanId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ledger-dpd", loanId],
    queryFn: () => getDpdHistory(loanId),
  });
  return <DpdHistoryTable grid={data} isLoading={isLoading} error={error} />;
}
