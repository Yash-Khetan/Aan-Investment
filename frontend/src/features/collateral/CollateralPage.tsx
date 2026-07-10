import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { LoanSelect } from "../lookup/LoanSelect";
import { getLoanCollaterals } from "./api";
import { CreateCollateralForm } from "./components/CreateCollateralForm";
import { CollateralRow } from "./components/CollateralRow";

export function CollateralPage() {
  const [loanId, setLoanId] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["collateral", loanId],
    queryFn: () => getLoanCollaterals(loanId),
    enabled: loanId !== "",
  });

  return (
    <div>
      <PageHeader title="Collateral" description="Security pledged against a loan — valuations, LTV, and insurance." />

      <div className="mb-6 flex items-end gap-3">
        <div className="w-96">
          <LoanSelect value={loanId} onChange={setLoanId} />
        </div>
        {loanId && (
          <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ Add Collateral"}</Button>
        )}
      </div>

      {!loanId && <EmptyState message="Select a loan to view or add collateral." />}

      {loanId && showForm && <CreateCollateralForm loanId={loanId} onDone={() => setShowForm(false)} />}

      {loanId && isLoading && <LoadingState label="Loading collateral..." />}
      {loanId && isError && (
        <ErrorState message={error instanceof Error ? error.message : "Failed to load collateral."} />
      )}
      {loanId && data && data.length === 0 && <EmptyState message="No collateral recorded for this loan yet." />}

      <div className="flex flex-col gap-3">
        {data?.map((c) => (
          <CollateralRow key={c.id} collateral={c} loanId={loanId} />
        ))}
      </div>
    </div>
  );
}
