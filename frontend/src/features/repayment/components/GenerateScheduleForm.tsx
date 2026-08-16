import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { TextAreaField } from "../../../components/ui/Field";
import { LoadingState, ErrorState } from "../../../components/ui/States";
import { formatCurrency, formatDate } from "../../../lib/format";
import { ApiError } from "../../../lib/api";
import { getLoan } from "../../loans/api";
import { getInterestConfig } from "../../interest/api";
import { CALCULATION_METHOD_OPTIONS, INTEREST_BASIS_OPTIONS } from "../../interest/types";
import { generateSchedule } from "../api";
import { REPAYMENT_TYPE_OPTIONS } from "../types";

/**
 * Nothing is entered manually here anymore — principal, rate, basis, method,
 * tenure, and repayment type all come from the loan and its current interest
 * config. This form just previews those values and confirms generation.
 */
export function GenerateScheduleForm({ loanId, onDone }: { loanId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState("");

  const { data: loan, isLoading: isLoadingLoan } = useQuery({
    queryKey: ["loan", loanId],
    queryFn: () => getLoan(loanId),
  });

  const {
    data: interestConfig,
    isLoading: isLoadingConfig,
    isError: isConfigError,
    error: configError,
  } = useQuery({
    queryKey: ["interest-config", loanId],
    queryFn: () => getInterestConfig(loanId),
    retry: false,
  });

  const configMissing = configError instanceof ApiError && configError.status === 404;

  const mutation = useMutation({
    mutationFn: generateSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repayment-schedule", loanId] });
      onDone();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ loanId, remarks: remarks || undefined });
  }

  const repaymentTypeLabel = loan
    ? (REPAYMENT_TYPE_OPTIONS.find((o) => o.value === loan.repaymentType)?.label ?? loan.repaymentType)
    : null;
  const basisLabel = interestConfig
    ? (INTEREST_BASIS_OPTIONS.find((o) => o.value === interestConfig.interestBasis)?.label ??
      interestConfig.interestBasis)
    : null;
  const methodLabel = interestConfig
    ? (CALCULATION_METHOD_OPTIONS.find((o) => o.value === interestConfig.calculationMethod)?.label ??
      interestConfig.calculationMethod)
    : null;

  return (
    <Card className="mb-6 p-4">
      <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Generate Schedule From Loan Details
      </div>

      {(isLoadingLoan || isLoadingConfig) && <LoadingState label="Loading loan and interest details..." />}

      {configMissing && (
        <ErrorState message="This loan has no interest configuration yet — set one up before generating a repayment schedule." />
      )}
      {isConfigError && !configMissing && (
        <ErrorState
          message={configError instanceof Error ? configError.message : "Failed to load interest configuration."}
        />
      )}

      {loan && interestConfig && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="text-xs font-medium text-slate-500">Principal</div>
              <div className="mt-1 text-sm text-slate-900">
                {formatCurrency(
                  Number(loan.disbursedAmount) > 0 ? loan.disbursedAmount : loan.sanctionedAmount,
                  2,
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Annual Rate</div>
              <div className="mt-1 text-sm text-slate-900">{Number(interestConfig.annualRate)}%</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Interest Basis</div>
              <div className="mt-1 text-sm text-slate-900">{basisLabel}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Method</div>
              <div className="mt-1 text-sm text-slate-900">{methodLabel}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Repayment Type</div>
              <div className="mt-1 text-sm text-slate-900">{repaymentTypeLabel}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Disbursement → Maturity</div>
              <div className="mt-1 text-sm text-slate-900">
                {formatDate(loan.firstDisbursementDate)} → {formatDate(loan.maturityDate)}
              </div>
            </div>
          </div>

          <TextAreaField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

          {mutation.isError && (
            <div className="text-xs text-red-600">
              {mutation.error instanceof Error ? mutation.error.message : "Failed to generate schedule."}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Generating..." : "Generate Schedule"}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
