import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../components/ui/Button";
import { LoadingState, ErrorState, EmptyState } from "../../../components/ui/States";
import { getLoanCollaterals } from "../api";
import { CreateCollateralForm } from "./CreateCollateralForm";
import { CollateralRow } from "./CollateralRow";
import { SECURITY_TYPE_ORDER } from "../types";

/** One loan's security: each item with its valuation, live LTV and insurance, plus adding more. */
export function LoanCollateral({ loanId, isUnsecured }: { loanId: string; isUnsecured: boolean }) {
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["collateral", loanId],
    queryFn: () => getLoanCollaterals(loanId),
    enabled: !isUnsecured,
  });

  if (isUnsecured) return <EmptyState message="This loan is unsecured, so it has no collateral." />;

  const sorted = data
    ? [...data].sort((a, b) => SECURITY_TYPE_ORDER.indexOf(a.securityType) - SECURITY_TYPE_ORDER.indexOf(b.securityType))
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "Add collateral"}</Button>
      </div>
      {showForm && <CreateCollateralForm loanId={loanId} onDone={() => setShowForm(false)} />}
      {isLoading && <LoadingState label="Loading collateral..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Could not load collateral."} />}
      {data && data.length === 0 && <EmptyState message="No collateral recorded for this loan yet." />}
      {sorted.map((c) => (
        <CollateralRow key={c.id} collateral={c} loanId={loanId} />
      ))}
    </div>
  );
}
