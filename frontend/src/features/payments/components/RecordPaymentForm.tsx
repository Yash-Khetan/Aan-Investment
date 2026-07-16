import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { formatCurrency, formatDate } from "../../../lib/format";
import { useAuth } from "../../auth/AuthContext";
import type { Installment } from "../../repayment/types";
import { recordPayment } from "../api";
import { PAYMENT_MODE_OPTIONS } from "../types";
import type { PaymentMode } from "../types";

export function RecordPaymentForm({
  loanId,
  installments,
}: {
  loanId: string;
  installments: Installment[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [paymentRefNumber, setPaymentRefNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("NEFT");
  const [transactionRef, setTransactionRef] = useState("");
  const [remarks, setRemarks] = useState("");
  const [installmentId, setInstallmentId] = useState("");
  const [outstandingPenalty, setOutstandingPenalty] = useState("0");
  const [outstandingInterest, setOutstandingInterest] = useState("0");
  const [outstandingPrincipal, setOutstandingPrincipal] = useState("0");

  const mutation = useMutation({
    mutationFn: recordPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repayment-schedule", loanId] });
      queryClient.invalidateQueries({ queryKey: ["payments", loanId] });
    },
  });

  function handleInstallmentChange(id: string) {
    setInstallmentId(id);
    const installment = installments.find((i) => i.id === id);
    if (installment) {
      setOutstandingPrincipal(String(Number(installment.principalAmount) - Number(installment.paidPrincipal)));
      setOutstandingInterest(String(Number(installment.interestAmount) - Number(installment.paidInterest)));
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      loanId,
      paymentRefNumber,
      amount: Number(amount),
      paymentDate,
      paymentMode,
      transactionRef: transactionRef || undefined,
      receivedBy: user?.id,
      remarks: remarks || undefined,
      installmentId: installmentId || undefined,
      outstandingPenalty: Number(outstandingPenalty),
      outstandingInterest: Number(outstandingInterest),
      outstandingPrincipal: Number(outstandingPrincipal),
    });
  }

  return (
    <Card className="mb-6 p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <TextField
            label="Payment Reference Number"
            value={paymentRefNumber}
            onChange={(e) => setPaymentRefNumber(e.target.value)}
            required
          />
          <TextField
            label="Amount (INR)"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <TextField
            label="Payment Date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />
          <SelectField
            label="Payment Mode"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
            required
          >
            {PAYMENT_MODE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Transaction Ref"
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
          />
          <SelectField
            label="Apply to Installment"
            value={installmentId}
            onChange={(e) => handleInstallmentChange(e.target.value)}
          >
            <option value="">None / not tied to a specific installment</option>
            {installments.map((i) => (
              <option key={i.id} value={i.id}>
                #{i.installmentNumber} — due {formatDate(i.dueDate)} — {formatCurrency(i.totalAmount)}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
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
            label="Outstanding Interest"
            type="number"
            step="0.01"
            min="0"
            value={outstandingInterest}
            onChange={(e) => setOutstandingInterest(e.target.value)}
          />
          <TextField
            label="Outstanding Penalty"
            type="number"
            step="0.01"
            min="0"
            value={outstandingPenalty}
            onChange={(e) => setOutstandingPenalty(e.target.value)}
          />
        </div>

        <TextAreaField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

        {mutation.isError && (
          <div className="text-xs text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : "Failed to record payment."}
          </div>
        )}

        <div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Recording..." : "Record Payment"}
          </Button>
        </div>
      </form>

      {mutation.data && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payment Recorded — Waterfall Allocation
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div>
              <div className="text-xs font-medium text-slate-500">Penalty Applied</div>
              <div className="mt-1 text-sm text-slate-900">
                {formatCurrency(mutation.data.waterfallResult.penaltyApplied)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Interest Applied</div>
              <div className="mt-1 text-sm text-slate-900">
                {formatCurrency(mutation.data.waterfallResult.interestApplied)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Principal Applied</div>
              <div className="mt-1 text-sm text-slate-900">
                {formatCurrency(mutation.data.waterfallResult.principalApplied)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Unallocated</div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                {formatCurrency(mutation.data.waterfallResult.unallocated)}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
