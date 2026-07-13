import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { formatDate } from "../../lib/format";
import { ApiError } from "../../lib/api";
import { LoanSelect } from "../lookup/LoanSelect";
import { getInterestConfig } from "./api";
import { INTEREST_BASIS_OPTIONS } from "./types";
import { CreateInterestConfigForm } from "./components/CreateInterestConfigForm";
import { CalculateInterestPanel } from "./components/CalculateInterestPanel";
import { InterestRulesPanel } from "./components/InterestRulesPanel";
import { PenalRulesPanel } from "./components/PenalRulesPanel";

export function InterestEnginePage() {
  const [loanId, setLoanId] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["interest-config", loanId],
    queryFn: () => getInterestConfig(loanId),
    enabled: loanId !== "",
    retry: false,
  });

  const notFound = error instanceof ApiError && error.status === 404;
  const basisLabel = data
    ? (INTEREST_BASIS_OPTIONS.find((o) => o.value === data.interestBasis)?.label ?? data.interestBasis)
    : null;

  return (
    <div>
      <PageHeader
        title="Interest Engine"
        description="Configure the interest calculation method for a loan and preview calculations."
      />

      <div className="mb-6 flex items-end gap-3">
        <div className="w-96">
          <LoanSelect
            value={loanId}
            onChange={(id) => {
              setLoanId(id);
              setShowForm(false);
            }}
          />
        </div>
        {loanId && (
          <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ Set Interest Config"}</Button>
        )}
      </div>

      {!loanId && <EmptyState message="Select a loan to view or configure its interest engine." />}

      {loanId && showForm && <CreateInterestConfigForm loanId={loanId} onDone={() => setShowForm(false)} />}

      {loanId && isLoading && <LoadingState label="Loading interest configuration..." />}
      {loanId && isError && !notFound && (
        <ErrorState message={error instanceof Error ? error.message : "Failed to load interest configuration."} />
      )}
      {loanId && notFound && !showForm && (
        <EmptyState message="No interest configuration set for this loan yet." />
      )}

      {loanId && data && (
        <Card className="mb-6 p-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div>
              <div className="text-xs font-medium text-slate-500">Annual Rate</div>
              <div className="mt-1 text-sm text-slate-900">{Number(data.annualRate)}%</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Interest Basis</div>
              <div className="mt-1 text-sm text-slate-900">{basisLabel}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Rule Type</div>
              <div className="mt-1 text-sm text-slate-900">{data.ruleType.replace(/_/g, " ")}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Effective From</div>
              <div className="mt-1 text-sm text-slate-900">{formatDate(data.effectiveFrom)}</div>
            </div>
            {data.customFormula && (
              <div className="col-span-2 lg:col-span-4">
                <div className="text-xs font-medium text-slate-500">Custom Formula</div>
                <div className="mt-1 font-mono text-sm text-slate-900">{data.customFormula}</div>
              </div>
            )}
            {data.remarks && (
              <div className="col-span-2 lg:col-span-4">
                <div className="text-xs font-medium text-slate-500">Remarks</div>
                <div className="mt-1 text-sm text-slate-700">{data.remarks}</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {loanId && data && <InterestRulesPanel interestConfigId={data.id} />}

      {loanId && <PenalRulesPanel loanId={loanId} />}

      {loanId && data && <CalculateInterestPanel loanId={loanId} disbursementDateHint={data.effectiveFrom} />}
    </div>
  );
}
