import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { generateSchedule } from "../api";
import { REPAYMENT_TYPE_OPTIONS } from "../types";
import type { RepaymentType } from "../types";

export function GenerateScheduleForm({ loanId, onDone }: { loanId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [principal, setPrincipal] = useState("");
  const [annualRate, setAnnualRate] = useState("");
  const [tenureMonths, setTenureMonths] = useState("");
  const [moratoriumMonths, setMoratoriumMonths] = useState("0");
  const [disbursementDate, setDisbursementDate] = useState("");
  const [repaymentType, setRepaymentType] = useState<RepaymentType>("EMI");
  const [remarks, setRemarks] = useState("");

  const mutation = useMutation({
    mutationFn: generateSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repayment-schedule", loanId] });
      onDone();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      loanId,
      principal: Number(principal),
      annualRate: Number(annualRate),
      tenureMonths: Number(tenureMonths),
      moratoriumMonths: Number(moratoriumMonths),
      disbursementDate,
      repaymentType,
      remarks: remarks || undefined,
    });
  }

  return (
    <Card className="mb-6 p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Principal (INR)"
            type="number"
            step="0.01"
            min="0"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            required
          />
          <TextField
            label="Annual Rate (%)"
            type="number"
            step="0.01"
            min="0"
            value={annualRate}
            onChange={(e) => setAnnualRate(e.target.value)}
            required
          />
          <TextField
            label="Tenure (months)"
            type="number"
            min="1"
            value={tenureMonths}
            onChange={(e) => setTenureMonths(e.target.value)}
            required
          />
          <TextField
            label="Moratorium (months)"
            type="number"
            min="0"
            value={moratoriumMonths}
            onChange={(e) => setMoratoriumMonths(e.target.value)}
          />
          <TextField
            label="Disbursement Date"
            type="date"
            value={disbursementDate}
            onChange={(e) => setDisbursementDate(e.target.value)}
            required
          />
          <SelectField
            label="Repayment Type"
            value={repaymentType}
            onChange={(e) => setRepaymentType(e.target.value as RepaymentType)}
            required
          >
            {REPAYMENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
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
    </Card>
  );
}
