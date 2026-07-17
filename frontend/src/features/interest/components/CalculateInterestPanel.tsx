import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField } from "../../../components/ui/Field";
import { formatCurrency } from "../../../lib/format";
import { calculateInterest } from "../api";

export function CalculateInterestPanel({
  loanId,
  disbursementDateHint,
}: {
  loanId: string;
  disbursementDateHint?: string | null;
}) {
  const [asOfDate, setAsOfDate] = useState("");
  const [loanDisbursementDate, setLoanDisbursementDate] = useState(disbursementDateHint ?? "");
  const [outstandingPrincipal, setOutstandingPrincipal] = useState("");
  const [overdueInstallmentAmount, setOverdueInstallmentAmount] = useState("0");
  const [daysLate, setDaysLate] = useState("0");
  const [wasExtended, setWasExtended] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      calculateInterest(loanId, {
        asOfDate,
        loanDisbursementDate,
        outstandingPrincipal: Number(outstandingPrincipal),
        overdueInstallmentAmount: Number(overdueInstallmentAmount),
        daysLate: Number(daysLate),
        wasExtended,
      }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Calculate Interest</div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TextField
            label="As Of Date"
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            required
          />
          <TextField
            label="Disbursement Date"
            type="date"
            value={loanDisbursementDate}
            onChange={(e) => setLoanDisbursementDate(e.target.value)}
            required
          />
          <TextField
            label="Outstanding Principal"
            type="number"
            step="0.01"
            min="0"
            value={outstandingPrincipal}
            onChange={(e) => setOutstandingPrincipal(e.target.value)}
            required
          />
          <TextField
            label="Overdue Installment Amount"
            type="number"
            step="0.01"
            min="0"
            value={overdueInstallmentAmount}
            onChange={(e) => setOverdueInstallmentAmount(e.target.value)}
          />
          <TextField
            label="Days Late"
            type="number"
            min="0"
            value={daysLate}
            onChange={(e) => setDaysLate(e.target.value)}
          />
          <SelectField
            label="Loan Extended?"
            value={wasExtended ? "yes" : "no"}
            onChange={(e) => setWasExtended(e.target.value === "yes")}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </SelectField>
        </div>

        {mutation.isError && (
          <div className="text-xs text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : "Calculation failed."}
          </div>
        )}

        <div>
          <Button type="submit" variant="secondary" disabled={mutation.isPending}>
            {mutation.isPending ? "Calculating..." : "Calculate"}
          </Button>
        </div>
      </form>

      {mutation.data && (
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 lg:grid-cols-4">
          <div>
            <div className="text-xs font-medium text-slate-500">Base Interest</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{formatCurrency(mutation.data.baseInterest)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Effective Rate</div>
            <div className="mt-1 text-sm text-slate-900">
              {mutation.data.effectiveRate}%{" "}
              <span className="text-xs text-slate-400">({mutation.data.rateSource.replace(/_/g, " ")})</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">
              Penalty {!mutation.data.penaltyApplied && "(not applied)"}
            </div>
            <div className="mt-1 text-sm text-slate-900">{formatCurrency(mutation.data.penalty)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Interest</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {formatCurrency(mutation.data.totalInterest)}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
