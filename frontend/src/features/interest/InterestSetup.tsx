import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LoadingState, ErrorState } from "../../components/ui/States";
import { formatDate } from "../../lib/format";
import { ApiError } from "../../lib/api";
import { getInterestConfig } from "./api";
import { INTEREST_BASIS_OPTIONS } from "./types";
import { CreateInterestConfigForm } from "./components/CreateInterestConfigForm";
import { CalculateInterestPanel } from "./components/CalculateInterestPanel";
import { InterestRulesPanel } from "./components/InterestRulesPanel";
import { PenalRulesPanel } from "./components/PenalRulesPanel";

/**
 * The complete interest engine for one loan — base config, step-up/step-down
 * rules, penal rule, and a calculation preview. Embedded in the loan creation
 * flow; the loan must already exist because every mutation keys off loanId.
 */
export function InterestSetup({ loanId }: { loanId: string }) {
  const [showReplaceForm, setShowReplaceForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["interest-config", loanId],
    queryFn: () => getInterestConfig(loanId),
    retry: false,
  });

  const notFound = error instanceof ApiError && error.status === 404;
  const basisLabel = data
    ? (INTEREST_BASIS_OPTIONS.find((o) => o.value === data.interestBasis)?.label ?? data.interestBasis)
    : null;

  if (isLoading) return <LoadingState label="Loading interest configuration..." />;

  if (isError && !notFound) {
    return (
      <ErrorState message={error instanceof Error ? error.message : "Failed to load interest configuration."} />
    );
  }

  return (
    <div>
      {/* No config yet: the create form IS the step, shown straight away. */}
      {notFound && !data && (
        <>
          <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Interest Configuration
          </div>
          <CreateInterestConfigForm loanId={loanId} onDone={() => {}} />

          <PenalRulesPanel loanId={loanId} />
        </>
      )}

      {data && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Interest Configuration
            </div>
            <Button variant="secondary" onClick={() => setShowReplaceForm((s) => !s)}>
              {showReplaceForm ? "Cancel" : "Replace Config"}
            </Button>
          </div>

          {showReplaceForm && (
            <CreateInterestConfigForm loanId={loanId} onDone={() => setShowReplaceForm(false)} />
          )}

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

          <InterestRulesPanel interestConfigId={data.id} />

          <PenalRulesPanel loanId={loanId} />

          <CalculateInterestPanel loanId={loanId} disbursementDateHint={data.effectiveFrom} />
        </>
      )}
    </div>
  );
}
