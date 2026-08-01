import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { LoanSelect } from "../lookup/LoanSelect";
import { getLoan } from "../loans/api";
import { getLoanCollaterals } from "./api";
import { CreateCollateralForm } from "./components/CreateCollateralForm";
import { CollateralRow } from "./components/CollateralRow";
import { SECURITY_TYPE_ORDER } from "./types";

export function CollateralPage() {
  const [loanId, setLoanId] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: loan } = useQuery({
    queryKey: ["loan", loanId],
    queryFn: () => getLoan(loanId),
    enabled: loanId !== "",
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["collateral", loanId],
    queryFn: () => getLoanCollaterals(loanId),
    enabled: loanId !== "",
  });

  const isUnsecured = loan?.loanType === "UNSECURED";
  const sortedCollaterals = data
    ? [...data].sort(
        (a, b) => SECURITY_TYPE_ORDER.indexOf(a.securityType) - SECURITY_TYPE_ORDER.indexOf(b.securityType),
      )
    : data;

  return (
    <div>
      <PageHeader title="Security / Collateral" description="Security pledged against a loan — valuations, LTV, and insurance." />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-96">
          <LoanSelect value={loanId} onChange={setLoanId} />
        </div>
        {loanId && !isUnsecured && (
          <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ Add Collateral"}</Button>
        )}
      </div>

      {!loanId && <EmptyState message="Select a loan to view or add collateral." />}

      {loanId && isUnsecured && <EmptyState message="This loan is unsecured — no security is required." />}

      {loanId && !isUnsecured && showForm && <CreateCollateralForm loanId={loanId} onDone={() => setShowForm(false)} />}

      {loanId && isLoading && <LoadingState label="Loading collateral..." />}
      {loanId && isError && (
        <ErrorState message={error instanceof Error ? error.message : "Failed to load collateral."} />
      )}
      {loanId && !isUnsecured && data && data.length === 0 && (
        <EmptyState message="No collateral recorded for this loan yet." />
      )}

      {!isUnsecured && (
        <div className="flex flex-col gap-3">
          {sortedCollaterals?.map((c) => (
            <CollateralRow key={c.id} collateral={c} loanId={loanId} />
          ))}
        </div>
      )}
    </div>
  );
}
