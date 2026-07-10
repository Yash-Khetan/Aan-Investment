import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/Field";
import { formatCurrency, formatDate } from "../../../lib/format";
import { deleteCollateral, getCollateralLtv, updateInsurance, updateValuation } from "../api";
import type { CollateralRecord } from "../types";

export function CollateralRow({ collateral, loanId }: { collateral: CollateralRecord; loanId: string }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"none" | "valuation" | "insurance">("none");
  const [ltv, setLtv] = useState<string | null>(null);

  const [newValue, setNewValue] = useState(collateral.estimatedValue ?? "");
  const [policyNumber, setPolicyNumber] = useState(collateral.insurance?.policyNumber ?? "");
  const [insurer, setInsurer] = useState(collateral.insurance?.insurer ?? "");
  const [insuredAmount, setInsuredAmount] = useState(collateral.insurance?.insuredAmount ?? "");
  const [expiryDate, setExpiryDate] = useState(collateral.insurance?.expiryDate ?? "");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["collateral", loanId] });

  const valuationMutation = useMutation({
    mutationFn: () => updateValuation(collateral.id, { estimatedValue: Number(newValue) }),
    onSuccess: () => {
      invalidate();
      setMode("none");
    },
  });

  const insuranceMutation = useMutation({
    mutationFn: () =>
      updateInsurance(collateral.id, {
        policyNumber,
        insurer: insurer || undefined,
        insuredAmount: insuredAmount ? Number(insuredAmount) : undefined,
        expiryDate: expiryDate || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setMode("none");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCollateral(collateral.id),
    onSuccess: invalidate,
  });

  async function handleLtv() {
    const result = await getCollateralLtv(collateral.id);
    setLtv(`${result.ltvPercentage}% (outstanding ${formatCurrency(result.loanOutstanding)} / value ${formatCurrency(result.marketValue)})`);
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge status={collateral.securityType} />
            <span className="text-sm font-medium text-slate-800">{collateral.description || "No description"}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">{collateral.propertyAddress}</div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
            <span>Est. Value: <strong className="text-slate-700">{formatCurrency(collateral.estimatedValue)}</strong></span>
            <span>Valued: {formatDate(collateral.valuationDate)}</span>
            <span>LTV: {collateral.ltvRatio ? `${collateral.ltvRatio}%` : "—"}</span>
            <span>
              Insurance:{" "}
              {collateral.insurance ? (
                <>
                  {collateral.insurance.policyNumber} (expires {formatDate(collateral.insurance.expiryDate)})
                </>
              ) : (
                "Not insured"
              )}
            </span>
          </div>
          {ltv && <div className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">Recalculated LTV: {ltv}</div>}
        </div>

        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={handleLtv}>
            Recalc LTV
          </Button>
          <Button variant="secondary" onClick={() => setMode(mode === "valuation" ? "none" : "valuation")}>
            Update Valuation
          </Button>
          <Button variant="secondary" onClick={() => setMode(mode === "insurance" ? "none" : "insurance")}>
            {collateral.insurance ? "Update Insurance" : "Add Insurance"}
          </Button>
          <Button variant="danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      </div>

      {mode === "valuation" && (
        <form
          className="mt-4 flex items-end gap-3 border-t border-slate-100 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            valuationMutation.mutate();
          }}
        >
          <TextField label="New Estimated Value" type="number" min="0" value={newValue} onChange={(e) => setNewValue(e.target.value)} required />
          <Button type="submit" disabled={valuationMutation.isPending}>
            {valuationMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </form>
      )}

      {mode === "insurance" && (
        <form
          className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            insuranceMutation.mutate();
          }}
        >
          <TextField label="Policy Number" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} required />
          <TextField label="Insurer" value={insurer} onChange={(e) => setInsurer(e.target.value)} />
          <TextField label="Insured Amount" type="number" min="0" value={insuredAmount} onChange={(e) => setInsuredAmount(e.target.value)} />
          <TextField label="Expiry Date" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          <div className="col-span-full">
            <Button type="submit" disabled={insuranceMutation.isPending}>
              {insuranceMutation.isPending ? "Saving..." : "Save Insurance"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
