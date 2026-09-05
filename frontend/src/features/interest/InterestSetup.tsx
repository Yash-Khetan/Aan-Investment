import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/Card";
import { LoadingState, ErrorState } from "../../components/ui/States";
import { formatDate } from "../../lib/format";
import { ApiError } from "../../lib/api";
import { getInterestConfig } from "./api";
import { CALCULATION_METHOD_OPTIONS, INTEREST_BASIS_OPTIONS } from "./types";
import { CreateInterestConfigForm } from "./components/CreateInterestConfigForm";
import { CalculateInterestPanel } from "./components/CalculateInterestPanel";
import { InterestRulesPanel } from "./components/InterestRulesPanel";
import { PenalRulesPanel } from "./components/PenalRulesPanel";

/**
 * The complete interest engine for one loan — base config, step-up/step-down
 * rules, penal rule, and a calculation preview. Embedded in the loan creation
 * flow; the loan must already exist because every mutation keys off loanId.
 *
 * The base configuration is shown read-only: the Loan module is where it is
 * edited, and saving it there writes a new effective-dated revision. Only a
 * legacy loan that has never had a configuration still gets the create form
 * below. The rules and penal panels remain editable here — they are the
 * Interest module's own, layered on top of the base configuration.
 */
export function InterestSetup({ loanId }: { loanId: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["interest-config", loanId],
    queryFn: () => getInterestConfig(loanId),
    retry: false,
  });

  const notFound = error instanceof ApiError && error.status === 404;
  const basisLabel = data
    ? (INTEREST_BASIS_OPTIONS.find((o) => o.value === data.interestBasis)?.label ?? data.interestBasis)
    : null;
  const methodLabel = data
    ? (CALCULATION_METHOD_OPTIONS.find((o) => o.value === data.calculationMethod)?.label ?? data.calculationMethod)
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
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Interest Configuration
            </div>
            <div className="text-xs text-slate-400">Edited in the Loan module — saved there, read here.</div>
          </div>

          <Card className="mb-6 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-xs font-medium text-slate-500">Annual Rate</div>
                <div className="mt-1 text-sm text-slate-900">{Number(data.annualRate)}%</div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">TDS Rate</div>
                <div className="mt-1 text-sm text-slate-900">{Number(data.tdsRatePercent)}%</div>
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
              <div>
                <div className="text-xs font-medium text-slate-500">Method</div>
                <div className="mt-1 text-sm text-slate-900">{methodLabel}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Include Opening &amp; Closing Days</div>
                <div className="mt-1 text-sm text-slate-900">{data.includeOpeningClosingDays ? "Yes" : "No"}</div>
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
