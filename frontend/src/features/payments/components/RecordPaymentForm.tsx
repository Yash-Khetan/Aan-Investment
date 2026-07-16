import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { formatCurrency, formatDate } from "../../../lib/format";
import { useAuth } from "../../auth/AuthContext";
import { getLoan } from "../../loans/api";
import { calculateInterest } from "../../interest/api";
import { getDaysLate } from "../../repayment/types";
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
  const [overflowAmount, setOverflowAmount] = useState<number | null>(null);
  const [isPenaltyCalculating, setIsPenaltyCalculating] = useState(false);
  const [penaltyAutoFillFailed, setPenaltyAutoFillFailed] = useState(false);

  const mutation = useMutation({
    mutationFn: recordPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repayment-schedule", loanId] });
      queryClient.invalidateQueries({ queryKey: ["payments", loanId] });
    },
  });

  const { data: loan } = useQuery({
    queryKey: ["loan", loanId],
    queryFn: () => getLoan(loanId),
  });

  // Auto-fills Outstanding Penalty from the loan's penal rule (via the same /calculate endpoint
  // Interest Engine uses), so the operator doesn't have to work it out and type it in by hand.
  // Still fully editable/overridable afterward. Recomputes on installment or payment-date change;
  // fails silently (e.g. no interest config exists for this loan yet) and leaves manual entry as
  // the fallback rather than blocking the form.
  useEffect(() => {
    if (!installmentId || !loan?.firstDisbursementDate) return;
    const installment = installments.find((i) => i.id === installmentId);
    if (!installment) return;

    const asOfDate = paymentDate || new Date().toISOString().slice(0, 10);
    const daysLate = getDaysLate(installment.dueDate, asOfDate);
    const overdueInstallmentAmount = Number(installment.totalAmount) - Number(installment.paidTotal);
    const loanOutstandingPrincipal = installments.reduce(
      (sum, i) => sum + (Number(i.principalAmount) - Number(i.paidPrincipal)),
      0,
    );

    let cancelled = false;
    setIsPenaltyCalculating(true);
    setPenaltyAutoFillFailed(false);

    calculateInterest(loanId, {
      asOfDate,
      loanDisbursementDate: loan.firstDisbursementDate,
      outstandingPrincipal: loanOutstandingPrincipal,
      overdueInstallmentAmount,
      daysLate,
      wasExtended: false,
    })
      .then((result) => {
        if (!cancelled) setOutstandingPenalty(String(result.penalty));
      })
      .catch(() => {
        if (!cancelled) setPenaltyAutoFillFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsPenaltyCalculating(false);
      });

    return () => {
      cancelled = true;
    };
    // installments is intentionally excluded — it's a filtered array recreated every render by the
    // parent, and every value this effect needs from it is re-read fresh from the closure anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installmentId, paymentDate, loanId, loan?.firstDisbursementDate]);

  function handleInstallmentChange(id: string) {
    setInstallmentId(id);
    const installment = installments.find((i) => i.id === id);
    if (installment) {
      setOutstandingPrincipal(String(Number(installment.principalAmount) - Number(installment.paidPrincipal)));
      setOutstandingInterest(String(Number(installment.interestAmount) - Number(installment.paidInterest)));
    } else {
      setOutstandingPrincipal("0");
      setOutstandingInterest("0");
    }
    // Always reset penalty on installment change — a stale value here silently diverts cash away from
    // principal/interest coverage, which can leave an installment stuck below its totalAmount forever.
    setOutstandingPenalty("0");
    setOverflowAmount(null);
  }

  function submitPayment(autoApplyOverflow: boolean) {
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
      autoApplyOverflow,
    });
    setOverflowAmount(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const totalOutstanding = Number(outstandingPrincipal) + Number(outstandingInterest) + Number(outstandingPenalty);
    const overflow = Number(amount) - totalOutstanding;

    // Only worth asking when the payment is tied to an installment — otherwise there's no "next
    // installment" to cascade into, so just record it (matches today's behavior for untied payments).
    if (installmentId && overflow > 0.004) {
      setOverflowAmount(overflow);
      return;
    }
    submitPayment(false);
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
                #{i.installmentNumber} — due {formatDate(i.dueDate)} — {formatCurrency(i.totalAmount, 2)}
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
          <div>
            <TextField
              label="Outstanding Penalty"
              type="number"
              step="0.01"
              min="0"
              value={outstandingPenalty}
              onChange={(e) => setOutstandingPenalty(e.target.value)}
            />
            {isPenaltyCalculating && <div className="mt-1 text-xs text-slate-400">Calculating from penal rule...</div>}
            {penaltyAutoFillFailed && (
              <div className="mt-1 text-xs text-slate-400">Couldn't auto-calculate — enter manually.</div>
            )}
          </div>
        </div>

        <TextAreaField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

        {mutation.isError && (
          <div className="text-xs text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : "Failed to record payment."}
          </div>
        )}

        {overflowAmount !== null ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div>
              This payment exceeds the selected installment's outstanding amount by{" "}
              <span className="font-medium">{formatCurrency(overflowAmount, 2)}</span>. Apply the extra to the
              loan's next due installment(s), or leave it unallocated?
            </div>
            <div className="mt-2 flex gap-2">
              <Button type="button" onClick={() => submitPayment(true)} disabled={mutation.isPending}>
                {mutation.isPending ? "Recording..." : "Apply to next installment(s)"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => submitPayment(false)}
                disabled={mutation.isPending}
              >
                Leave unallocated
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOverflowAmount(null)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        )}
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

          {mutation.data.installmentsSettled.length > 0 && (
            <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Overflow applied to installment{mutation.data.installmentsSettled.length > 1 ? "s" : ""}:{" "}
              {mutation.data.installmentsSettled
                .map(
                  (i) =>
                    `#${i.installmentNumber} (${formatCurrency(i.principalApplied + i.interestApplied, 2)})`,
                )
                .join(", ")}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
